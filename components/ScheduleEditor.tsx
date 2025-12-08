import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Play, BookOpen, Clock, AlertTriangle, Lightbulb, Zap, Edit } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FiringSchedule, FiringSegment, createEmptySegment, calculateSchedulePoints, calculateTheoreticalDuration, SampleType, sampleTypeLabels, FiringStage, FiringStageLabels } from '../types';
import { analyzeWithExperience } from '../services/experienceService';
import { generateSchedule } from '../services/generatorService';

interface Props {
  onStartFiring: (schedule: FiringSchedule) => void;
  calibrationFactor: number;
  isDarkMode?: boolean;
}

const TEMPLATES: Record<string, { name: string, segments: FiringSegment[] }> = {
  bisque: {
    name: "標準素燒 (800°C)",
    segments: [
      { id: 't1', type: 'ramp', rate: 100, targetTemp: 600 },
      { id: 't2', type: 'ramp', rate: 150, targetTemp: 800 },
      { id: 't3', type: 'hold', targetTemp: 800, holdTime: 10 }
    ]
  },
  glaze: {
    name: "標準釉燒 (1230°C)",
    segments: [
      { id: 'g1', type: 'ramp', rate: 150, targetTemp: 1000 },
      { id: 'g2', type: 'ramp', rate: 100, targetTemp: 1230 },
      { id: 'g3', type: 'hold', targetTemp: 1230, holdTime: 20 }
    ]
  },
  slow_dry: {
    name: "慢速烘乾 (120°C)",
    segments: [
      { id: 'd1', type: 'ramp', rate: 60, targetTemp: 120 },
      { id: 'd2', type: 'hold', targetTemp: 120, holdTime: 60 }
    ]
  }
};

const ScheduleEditor: React.FC<Props> = ({ onStartFiring, calibrationFactor, isDarkMode = false }) => {
  const [segments, setSegments] = useState<FiringSegment[]>([]);
  const [name, setName] = useState('新排程');
  const [clayWeight, setClayWeight] = useState<number>(0);
  const [sampleType, setSampleType] = useState<SampleType>('standard');
  const [firingStage, setFiringStage] = useState<FiringStage>('uncertain'); 
  const [isManualEdit, setIsManualEdit] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // 排程生成邏輯
  const generatorResult = useMemo(() => {
    if (firingStage === 'uncertain') {
        return { 
            segments: [], 
            warnings: ["請選擇【素燒】或【釉燒】以產生建議排程。"], 
            advice: [], 
            estimatedDurationMinutes: 0, 
            timeModifier: 1.0 
        };
    }
    return generateSchedule(sampleType, firingStage, clayWeight);
  }, [sampleType, firingStage, clayWeight]);

  // 同步排程
  useEffect(() => {
    if (!isManualEdit && generatorResult.segments.length > 0) {
        setSegments(generatorResult.segments);
        setName(`${FiringStageLabels[firingStage].split(' ')[0]} - ${sampleTypeLabels[sampleType].split(' ')[0]}`);
    } else if (firingStage === 'uncertain' && !isManualEdit) {
         setSegments([]);
         setName('自訂排程');
    }
  }, [generatorResult.segments, isManualEdit, firingStage, sampleType]);

  const generalAnalysis = analyzeWithExperience(sampleType, segments, clayWeight); 

  const durationModifier = generatorResult.timeModifier || generalAnalysis.timeModifier;
  
  const rawMinutes = segments.length > 0 ? calculateTheoreticalDuration(segments) : 0; 

  const adjustedMinutes = Math.round(rawMinutes * calibrationFactor * durationModifier);
  
  const estimatedEndTime = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getTime() + adjustedMinutes * 60000);
    return end;
  }, [adjustedMinutes]);

  const chartData = useMemo(() => {
    const points = calculateSchedulePoints(segments);
    return points.map(p => ({
      time: Math.round((p.time / 60) * 10) / 10,
      temp: p.temp
    }));
  }, [segments]);

  const handleSegmentChange = (callback: () => void) => {
    setIsManualEdit(true);
    callback();
  };
  
  const handleAddSegment = () => handleSegmentChange(() => setSegments([...segments, createEmptySegment()]));
  const handleRemoveSegment = (id: string) => handleSegmentChange(() => setSegments(segments.filter(s => s.id !== id)));

  const handleUpdateSegment = (id: string, field: keyof FiringSegment, value: number | string) => {
    handleSegmentChange(() => setSegments(segments.map(s => s.id === id ? { ...s, [field]: value } : s)));
  };
  
  const handleLoadTemplate = (key: string) => {
     const t = TEMPLATES[key];
     const newSegs = t.segments.map(s => ({...s, id: crypto.randomUUID()}));
     setSegments(newSegs);
     setName(t.name);
     setIsManualEdit(true); 
     setShowTemplates(false);
     setFiringStage('uncertain');
  };
  
  const handleToggleManualEdit = () => {
    if (isManualEdit) {
        setFiringStage('bisque');
        setIsManualEdit(false);
    } else {
        setIsManualEdit(true);
    }
  }

  const handleStart = () => {
    if (segments.length === 0) {
        alert("排程內容為空，請先生成或手動新增燒製區段。");
        return;
    }

    onStartFiring({
      id: crypto.randomUUID(),
      name,
      segments,
      estimatedDurationMinutes: adjustedMinutes,
      clayWeight,
      sampleType,
      firingStage 
    });
  };

  const combinedWarnings = isManualEdit ? generalAnalysis.warnings : (generatorResult.warnings || []);
  const combinedAdvice = isManualEdit ? generalAnalysis.advice : (generatorResult.advice || []);
  
  const chartGridColor = isDarkMode ? '#44403c' : '#e7e5e4';
  const chartAxisColor = isDarkMode ? '#a8a29e' : '#a8a29e';
  const chartTooltipBg = isDarkMode ? '#292524' : '#fff';
  const chartTooltipBorder = isDarkMode ? '#57534e' : '#e5e7eb';
  const chartLineColor = isDarkMode ? '#b0776b' : '#b0776b';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white dark:bg-stone-900 rounded-xl shadow-sm border border-stone-200 dark:border-stone-800 p-6 transition-colors">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-stone-100 dark:border-stone-800">
            <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                <Zap className="w-6 h-6 text-clay-500" />
                {isManualEdit ? '手動排程微調' : '智能排程生成器'}
            </h2>
            
            <div className="flex gap-2">
                <div className="relative">
                    <button 
                        onClick={() => setShowTemplates(!showTemplates)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                    >
                        <BookOpen className="w-4 h-4" /> 載入模板
                    </button>
                    {showTemplates && (
                        <div className="absolute right-0 top-10 w-48 bg-white dark:bg-stone-800 rounded-xl shadow-xl border border-stone-200 dark:border-stone-700 z-10 overflow-hidden">
                            {Object.entries(TEMPLATES).map(([key, t]) => (
                                <button
                                    key={key}
                                    onClick={() => handleLoadTemplate(key)}
                                    className="w-full text-left px-4 py-3 text-sm text-stone-700 dark:text-stone-300 hover:bg-clay-50 dark:hover:bg-stone-700 hover:text-clay-700 dark:hover:text-clay-400 transition-colors border-b border-stone-100 dark:border-stone-700 last:border-0"
                                >
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-right font-medium text-stone-600 dark:text-stone-300 bg-transparent border-b border-transparent hover:border-stone-300 focus:border-clay-500 focus:outline-none px-2 w-40 transition-colors"
                />
            </div>
          </div>

          <div className="space-y-4 mb-6">
              <div className="p-4 bg-stone-50 dark:bg-stone-800/50 rounded-lg border border-stone-200 dark:border-stone-700 mb-4">
                <h3 className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase mb-3">請輸入參數</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase mb-1">燒製階段</label>
                      <select
                        value={firingStage}
                        onChange={(e) => { 
                            setFiringStage(e.target.value as FiringStage);
                            setIsManualEdit(false); 
                        }}
                        className="w-full p-2 rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-1 focus:ring-clay-500 focus:outline-none"
                      >
                        {Object.entries(FiringStageLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                   </div>
                   
                   <div>
                      <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase mb-1">作品厚度 / 類型</label>
                      <select
                        value={sampleType}
                        onChange={(e) => {
                            setSampleType(e.target.value as SampleType);
                            if (firingStage !== 'uncertain') setIsManualEdit(false);
                        }}
                        className="w-full p-2 rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-1 focus:ring-clay-500 focus:outline-none"
                      >
                        {Object.entries(sampleTypeLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                   </div>
                   
                   <div>
                      <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase mb-1">預估總重 (kg)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={clayWeight}
                        onChange={(e) => {
                            setClayWeight(Math.max(0, Number(e.target.value)));
                            if (firingStage !== 'uncertain') setIsManualEdit(false);
                        }}
                        className="w-full p-2 rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-1 focus:ring-clay-500 focus:outline-none"
                      />
                   </div>
                </div>
              </div>

              {(combinedAdvice.length > 0 || combinedWarnings.length > 0) && (
                <div className="mb-4 space-y-2">
                   {combinedWarnings.map((warn, i) => (
                     <div key={i} className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm rounded-lg border border-red-100 dark:border-red-800 animate-pulse">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{warn}</span>
                     </div>
                   ))}
                   {combinedAdvice.map((adv, i) => (
                     <div key={i} className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm rounded-lg border border-blue-100 dark:border-blue-800">
                        <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{adv}</span>
                     </div>
                   ))}
                </div>
              )}
              
              <div className="flex justify-between items-center mb-4 pt-2 border-t border-stone-100 dark:border-stone-800">
                  <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">
                     排程區段 ({segments.length} 段)
                  </h3>
                  <button
                      onClick={handleToggleManualEdit}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                  >
                      <Edit className="w-3 h-3" /> 
                      {isManualEdit ? '退出手動模式' : '手動微調'}
                  </button>
              </div>

              <div className="space-y-4">
                  {segments.map((seg, idx) => (
                    <div key={seg.id} className="flex flex-wrap md:flex-nowrap items-end gap-3 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-lg border border-stone-200 dark:border-stone-700 transition-colors group">
                      <div className="w-8 font-bold text-stone-400 text-sm pt-3">#{idx + 1}</div>
                      
                      <div className="flex-1 min-w-[100px]">
                        <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase mb-1">類型</label>
                        <select
                          value={seg.type}
                          onChange={(e) => handleUpdateSegment(seg.id, 'type', e.target.value)}
                          className={`w-full p-2 rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-1 focus:ring-clay-500 focus:outline-none ${!isManualEdit ? 'opacity-70 pointer-events-none' : ''}`}
                          disabled={!isManualEdit}
                        >
                          <option value="ramp">升/降溫 (Ramp)</option>
                          <option value="hold">持溫 (Hold)</option>
                        </select>
                      </div>

                      {seg.type === 'ramp' && (
                        <div className="flex-1 min-w-[80px]">
                          <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase mb-1">速率 (°C/hr)</label>
                          <input
                            type="number"
                            value={seg.rate}
                            onChange={(e) => handleUpdateSegment(seg.id, 'rate', Number(e.target.value))}
                            className={`w-full p-2 rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-1 focus:ring-clay-500 focus:outline-none ${!isManualEdit ? 'opacity-70 pointer-events-none' : ''}`}
                            disabled={!isManualEdit}
                          />
                        </div>
                      )}

                      <div className="flex-1 min-w-[80px]">
                        <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase mb-1">目標溫 (°C)</label>
                        <input
                          type="number"
                          value={seg.targetTemp}
                          onChange={(e) => handleUpdateSegment(seg.id, 'targetTemp', Number(e.target.value))}
                          className={`w-full p-2 rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-1 focus:ring-clay-500 focus:outline-none ${!isManualEdit ? 'opacity-70 pointer-events-none' : ''}`}
                          disabled={!isManualEdit}
                        />
                      </div>

                      {seg.type === 'hold' && (
                        <div className="flex-1 min-w-[80px]">
                          <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase mb-1">時間 (分)</label>
                          <input
                            type="number"
                            value={seg.holdTime}
                            onChange={(e) => handleUpdateSegment(seg.id, 'holdTime', Number(e.target.value))}
                            className={`w-full p-2 rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:ring-1 focus:ring-clay-500 focus:outline-none ${!isManualEdit ? 'opacity-70 pointer-events-none' : ''}`}
                            disabled={!isManualEdit}
                          />
                        </div>
                      )}

                      <button
                        onClick={() => handleRemoveSegment(seg.id)}
                        className={`p-2 text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 ${!isManualEdit ? 'opacity-0 pointer-events-none' : ''}`}
                        title="移除區段"
                        disabled={!isManualEdit}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
            </div>

            <button
              onClick={handleAddSegment}
              disabled={!isManualEdit}
              className={`w-full py-3 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-lg transition-colors flex justify-center items-center gap-2 mt-4 ${
                 isManualEdit 
                 ? 'text-stone-500 dark:text-stone-400 hover:border-clay-500 hover:text-clay-600 dark:hover:text-clay-400' 
                 : 'text-stone-700 dark:text-stone-600 opacity-50 cursor-not-allowed'
              }`}
            >
              <Plus className="w-5 h-5" /> 手動新增區段
            </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-stone-900 rounded-xl shadow-sm border border-stone-200 dark:border-stone-800 p-4 h-64 flex flex-col transition-colors" style={{ minHeight: '256px' }}>
          <h3 className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase mb-2">溫度曲線預覽</h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                <XAxis 
                  dataKey="time" 
                  unit="h" 
                  fontSize={10} 
                  stroke={chartAxisColor}
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fill: chartAxisColor }}
                />
                <YAxis 
                  unit="°C" 
                  fontSize={10} 
                  stroke={chartAxisColor} 
                  width={35}
                  tick={{ fill: chartAxisColor }}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '8px', 
                    fontSize: '12px',
                    backgroundColor: chartTooltipBg,
                    borderColor: chartTooltipBorder,
                    color: isDarkMode ? '#f5f5f4' : '#1c1917'
                  }}
                  itemStyle={{ color: isDarkMode ? '#f5f5f4' : '#1c1917' }}
                  formatter={(value: number) => [`${value}°C`, '溫度']}
                  labelFormatter={(label) => `${label} 小時`}
                />
                <Line 
                  type="monotone" 
                  dataKey="temp" 
                  stroke={chartLineColor} 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-stone-900 dark:bg-stone-950 text-white p-6 rounded-xl shadow-lg sticky top-6 border border-stone-800">
          <div className="mb-6">
            <div className="text-stone-300 dark:text-stone-400 text-sm mb-1">預估總時間</div>
            <div className="text-4xl font-bold font-mono mb-2">
              {Math.floor(adjustedMinutes / 60)}<span className="text-xl">小時</span> {adjustedMinutes % 60}<span className="text-xl">分</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-green-400 bg-green-900/20 py-1 px-2 rounded w-fit">
                 <Clock className="w-4 h-4" />
                 預計結束：{estimatedEndTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>

            <div className="text-xs text-stone-400 mt-3 bg-stone-800 p-2 rounded space-y-1">
              <div>• 理論時間：{Math.floor(rawMinutes / 60)}時 {rawMinutes % 60}分</div>
              {(calibrationFactor !== 1) && <div>• 歷史校正：{calibrationFactor > 1 ? '+' : ''}{Math.round((calibrationFactor - 1) * 100)}%</div>}
              {(durationModifier !== 1) && <div>• 樣品修正：{durationModifier > 1 ? '+' : ''}{Math.round((durationModifier - 1) * 100)}% ({sampleTypeLabels[sampleType]})</div>}
            </div>
          </div>
          
          <button
            onClick={handleStart}
            disabled={combinedWarnings.length > 0 || segments.length === 0}
            className={`w-full py-4 rounded-lg font-bold text-lg shadow-lg transition-all transform flex justify-center items-center gap-2 ${
               (combinedWarnings.length > 0 || segments.length === 0)
               ? 'bg-stone-700 text-stone-500 cursor-not-allowed'
               : 'bg-clay-500 hover:bg-clay-400 text-white hover:shadow-xl hover:-translate-y-0.5'
            }`}
          >
            {(combinedWarnings.length > 0 || segments.length === 0) ? (
               <><AlertTriangle className="w-6 h-6" /> 請先修正排程</>
            ) : (
               <><Play className="w-6 h-6 fill-current" /> 開始燒製</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleEditor;