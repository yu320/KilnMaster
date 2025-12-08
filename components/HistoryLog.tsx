import React, { useState } from 'react';
import { FiringLog, CalibrationResult, outcomeMap } from '../types';
import { calculateLocalCalibration } from '../services/calibrationService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Brush } from 'recharts';
import { Calculator, History as HistoryIcon, ArrowUpRight, ArrowDownRight, Download } from 'lucide-react';

interface Props {
  logs: FiringLog[];
  calibration: CalibrationResult;
  onUpdateCalibration: (result: CalibrationResult) => void;
  isDarkMode?: boolean;
}

const HistoryLog: React.FC<Props> = ({ logs, calibration, onUpdateCalibration, isDarkMode = false }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleRecalibrate = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
        const result = calculateLocalCalibration(logs);
        onUpdateCalibration(result);
        setIsAnalyzing(false);
    }, 600);
  };

  const handleExport = () => {
    const BOM = "\uFEFF";
    const metaRows = [
      ["參數", "數值"],
      ["目前校正係數", calibration.factor.toString()],
      ["系統建議", calibration.advice.replace(/[\n\r]+/g, ' ')]
    ];
    const headers = ["排程名稱", "日期", "預估時間(分鐘)", "實際時間(分鐘)", "誤差(分鐘)", "結果", "備註"];
    const sortedLogs = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const dataRows = sortedLogs.map(log => {
        const diff = log.actualDuration - log.predictedDuration;
        return [
            log.scheduleName,
            new Date(log.date).toLocaleString('zh-TW'),
            log.predictedDuration,
            log.actualDuration,
            diff,
            outcomeMap[log.outcome] || log.outcome,
            log.notes || ''
        ];
    });

    const escape = (val: string | number) => {
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const csvContent = BOM + [
        ...metaRows.map(row => row.map(escape).join(",")),
        "", 
        headers.map(escape).join(","),
        ...dataRows.map(row => row.map(escape).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kiln_data_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const chartData = logs.map(log => ({
    name: new Date(log.date).toLocaleDateString(undefined, {month:'short', day:'numeric'}),
    predicted: Math.round(log.predictedDuration / 60 * 10) / 10,
    actual: Math.round(log.actualDuration / 60 * 10) / 10,
  })).slice(-20); 

  const chartGridColor = isDarkMode ? '#44403c' : '#e5e7eb';
  const chartAxisColor = isDarkMode ? '#a8a29e' : '#78716c';
  const chartTooltipBg = isDarkMode ? '#292524' : '#fff';
  const chartTooltipBorder = isDarkMode ? '#57534e' : '#e5e7eb';

  return (
    <div className="space-y-8">
      {/* Calibration Card */}
      <div className="bg-gradient-to-br from-stone-800 to-stone-900 dark:from-stone-900 dark:to-black rounded-xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="text-clay-400" />
              數據校正中心
            </h2>
            <p className="text-stone-400 mt-2 max-w-lg">
              系統使用加權平均演算法分析歷史數據。
              目前系統會將所有預估時間乘以 <strong>{calibration.factor.toFixed(3)}x</strong> 倍。
            </p>
          </div>
          <button
            onClick={handleRecalibrate}
            disabled={isAnalyzing || logs.length === 0}
            className="px-6 py-3 bg-clay-600 hover:bg-clay-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition-all shadow-lg text-sm whitespace-nowrap"
          >
            {isAnalyzing ? '計算中...' : '執行校正'}
          </button>
        </div>
        
        {calibration.advice && (
          <div className="mt-6 p-4 bg-white/10 rounded-lg border border-white/10 text-sm leading-relaxed text-clay-100">
            <span className="text-clay-300 font-bold uppercase text-xs tracking-wider block mb-1">分析報告</span>
            {calibration.advice}
          </div>
        )}
      </div>

      {/* Chart */}
      {logs.length > 0 ? (
        // 修改這裡：加入 inline style height
        <div className="bg-white dark:bg-stone-900 p-6 rounded-xl border border-stone-200 dark:border-stone-800 shadow-sm h-[350px] transition-colors" style={{ height: '350px' }}>
          <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4">預估 vs 實際時間 (小時)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
              <XAxis dataKey="name" stroke={chartAxisColor} fontSize={12} tick={{ fill: chartAxisColor }} />
              <YAxis stroke={chartAxisColor} fontSize={12} tick={{ fill: chartAxisColor }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: chartTooltipBg, 
                  border: `1px solid ${chartTooltipBorder}`, 
                  borderRadius: '8px',
                  color: isDarkMode ? '#f5f5f4' : '#1c1917'
                }}
                itemStyle={{ color: isDarkMode ? '#f5f5f4' : '#1c1917' }}
                formatter={(value: number) => [`${value} 小時`, '']}
              />
              <Legend wrapperStyle={{ color: isDarkMode ? '#d6d3d1' : '#57534e' }} />
              <Line type="monotone" dataKey="predicted" stroke="#a8a29e" strokeWidth={2} name="預估時間" />
              <Line type="monotone" dataKey="actual" stroke="#b0776b" strokeWidth={2} name="實際時間" />
              <Brush dataKey="name" height={30} stroke="#b0776b" fill={isDarkMode ? "#292524" : "#f5f5f4"} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-stone-50 dark:bg-stone-900 border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-xl p-12 text-center text-stone-400">
          尚未有燒製紀錄。完成一次燒製後即可查看分析。
        </div>
      )}

      {/* List */}
      <div className="space-y-4">
         <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
              <HistoryIcon className="w-5 h-5" /> 近期紀錄
            </h3>
            <button onClick={handleExport} disabled={logs.length === 0} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-stone-600 dark:text-stone-300 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 hover:text-stone-900 dark:hover:text-stone-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                <Download className="w-4 h-4" /> 匯出 CSV
            </button>
        </div>
        
        {logs.length === 0 && <p className="text-stone-500 italic">尚無歷史紀錄。</p>}
        {logs.slice().reverse().map(log => {
           const diff = log.actualDuration - log.predictedDuration;
           const diffPercent = ((diff / log.predictedDuration) * 100).toFixed(1);
           const isSlower = diff > 0;
           return (
            <div key={log.id} className="bg-white dark:bg-stone-900 p-4 rounded-lg border border-stone-200 dark:border-stone-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-all">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                    <div className="font-bold text-stone-800 dark:text-stone-100">{log.scheduleName}</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        log.outcome === 'perfect' ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' :
                        (log.outcome === 'error' || log.outcome === 'failure') ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' :
                        'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'
                    }`}>
                        {outcomeMap[log.outcome] || log.outcome}
                    </span>
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">{new Date(log.date).toLocaleString()}</div>
                {log.notes && <div className="text-sm text-stone-600 dark:text-stone-300 mt-2 bg-stone-50 dark:bg-stone-800 p-2 rounded">{log.notes}</div>}
              </div>
              
              <div className="flex gap-8 text-sm shrink-0">
                <div>
                  <div className="text-stone-400 text-xs uppercase">預估</div>
                  <div className="font-mono text-stone-600 dark:text-stone-400">{Math.floor(log.predictedDuration/60)}時 {log.predictedDuration%60}分</div>
                </div>
                <div>
                  <div className="text-stone-400 text-xs uppercase">實際</div>
                  <div className="font-mono font-bold text-stone-800 dark:text-stone-200">{Math.floor(log.actualDuration/60)}時 {Math.floor(log.actualDuration%60)}分</div>
                </div>
              </div>

              <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-24 justify-center shrink-0 ${
                Math.abs(diff) < 15 
                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' 
                  : isSlower 
                    ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400' 
                    : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
              }`}>
                {Math.abs(diff) < 15 ? '準確' : (
                  <>
                    {isSlower ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {diffPercent}%
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HistoryLog;