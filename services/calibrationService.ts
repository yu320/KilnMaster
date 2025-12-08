import { FiringLog, CalibrationResult } from "../types";

// Replaces AI analysis with a deterministic statistical approach
// Now uses Exponential Weighting and Theoretical Baseline for advanced precision
export const calculateLocalCalibration = (history: FiringLog[]): CalibrationResult => {
  if (history.length === 0) {
    return { factor: 1, advice: "尚無歷史數據可供校正。" };
  }

  // 1. Filter out 'error' and 'failure' outcomes (manual aborts, errors, failed firings)
  // 2. Sort by date ascending (oldest first) to ensure index 0 is oldest
  const validLogs = history
    .filter(log => log.outcome !== 'error' && log.outcome !== 'failure')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (validLogs.length === 0) {
    return { factor: 1, advice: "有效數據不足（已排除錯誤/失敗/中止紀錄）。" };
  }

  let totalWeightedRatio = 0;
  let totalWeight = 0;
  
  // Advanced Weighting Configuration:
  // Base 1.6: Recent firings are significantly more important.
  // 1st log: 1, 5th log: 6.5, 10th log: 68.
  const base = 1.6;

  validLogs.forEach((log, index) => {
    // Advanced Logic: Prefer Theoretical Duration as baseline
    // If log has theoreticalDuration (new format), use it: Actual / Theoretical
    // If log only has predictedDuration (old format), use: Actual / Predicted
    // Note: Using predicted is less accurate as it contains the old factor, but best we can do for legacy data.
    
    let ratio = 1;
    if (log.theoreticalDuration && log.theoreticalDuration > 0) {
        ratio = log.actualDuration / log.theoreticalDuration;
    } else {
        ratio = log.actualDuration / log.predictedDuration;
    }
    
    // Outlier Filter: Ignore data points with > 50% deviation (likely anomalies)
    if (ratio > 1.5 || ratio < 0.5) {
        return; 
    }

    // Exponential weighting: base ^ index
    const weight = Math.pow(base, index);
    
    totalWeightedRatio += ratio * weight;
    totalWeight += weight;
  });

  // If all logs were filtered out as outliers (unlikely but possible)
  if (totalWeight === 0) {
      return { factor: 1, advice: "數據偏差過大，無法進行有效校正。請檢查電窯是否故障。" };
  }

  const weightedFactor = totalWeightedRatio / totalWeight;
  const percentage = Math.round((weightedFactor - 1) * 100);
  
  let advice = "";
  const count = validLogs.length;
  const method = validLogs.some(l => l.theoreticalDuration) ? "絕對理論值" : "歷史預估值";
  
  if (Math.abs(percentage) < 1) {
    advice = `系統分析了 ${count} 筆有效紀錄。您的電窯表現非常精準，實際時間與理論值幾乎一致。`;
  } else if (percentage > 0) {
    advice = `系統使用「指數加權」與「${method}」分析了 ${count} 筆有效紀錄。您的電窯近期平均比理論值慢約 ${percentage}%。可能是保溫效果良好導致降溫慢，或加熱元件老化。已自動更新參數以延長預估時間。`;
  } else {
    advice = `系統使用「指數加權」與「${method}」分析了 ${count} 筆有效紀錄。您的電窯近期平均比理論值快約 ${Math.abs(percentage)}%。這可能表示電窯功率強勁或負載較輕。已自動更新參數以縮短預估時間。`;
  }

  return {
    factor: Number(weightedFactor.toFixed(3)),
    advice: advice
  };
};