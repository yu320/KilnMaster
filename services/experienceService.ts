import { FiringSegment, SampleType } from "../types";

interface ExperienceResult {
  timeModifier: number; 
  advice: string[];     
  warnings: string[];   
}

/**
 * 老師傅經驗法則引擎 - 用於手動編輯時的安全檢查
 */
export const analyzeWithExperience = (
  type: SampleType,
  segments: FiringSegment[],
  clayWeight: number
): ExperienceResult => {
  const result: ExperienceResult = {
    timeModifier: 1.0,
    advice: [],
    warnings: []
  };

  switch (type) {
    case 'thick': result.timeModifier = 1.15; break;
    case 'sculpture': result.timeModifier = 1.25; break;
    case 'large_flat': result.timeModifier = 1.05; break;
    case 'thin': result.timeModifier = 0.95; break;
    case 'standard': default: result.timeModifier = 1.0; break;
  }
  
  if (clayWeight > 5) {
    result.timeModifier += 0.05;
  }
  
  let currentTemp = 25;
  let hasLowTempHold = false; 

  segments.forEach((seg, index) => {
    const startTemp = currentTemp;
    
    if (seg.type === 'ramp') currentTemp = seg.targetTemp;
    
    if (seg.type === 'ramp' && seg.rate && seg.rate > 0) {
      // 0-200度初期升溫檢查
      if ((type === 'thick' || type === 'sculpture') && startTemp < 200 && seg.rate > 100) {
        result.warnings.push(`⚠️ 危險 (段落 ${index + 1})：200°C 以下升溫速率 ${seg.rate}°C/h 對「${type === 'thick' ? '厚胎' : '雕塑'}」來說太快了！建議降至 100°C/h 以下。`);
      }

      // 石英相變區檢查 (~573°C)
      const passesQuartzInversion = (startTemp < 573 && seg.targetTemp > 573) || (startTemp > 573 && seg.targetTemp < 573);
      
      if (passesQuartzInversion) {
        if ((type === 'large_flat' || type === 'sculpture') && seg.rate > 150) {
          result.warnings.push(`⚠️ 危險 (段落 ${index + 1})：跨越 573°C 石英相變區速率太快！建議降至 150°C/h 以下。`);
        }
      }
    }

    if (seg.type === 'hold' && seg.targetTemp <= 130 && seg.holdTime && seg.holdTime >= 30) {
      hasLowTempHold = true;
    }
  });

  if ((type === 'thick' || type === 'sculpture') && !hasLowTempHold && segments.length > 0) {
    result.warnings.push("⚠️ 強烈建議：檢測到厚重作品，但未設定「低溫烘乾段」。建議在 100-120°C 設定至少 30-60 分鐘的持溫烘乾段。");
  }

  return result;
};