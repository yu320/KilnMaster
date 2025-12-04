import React, { useEffect, useState, useMemo, useRef } from 'react';
import { FiringSchedule, calculateSchedulePoints, FiringLog } from '../types';
import { Bell, BellOff, XCircle, CheckCircle, Thermometer, Settings, Plus, Trash2, Zap, ZapOff } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';

interface Props {
  schedule: FiringSchedule;
  startTime: number;
  onFinish: (result: Pick<FiringLog, 'actualDuration' | 'outcome' | 'notes'>) => void;
  onCancel: () => void;
  isDarkMode?: boolean;
}

const ActiveFiring: React.FC<Props> = ({ schedule, startTime, onFinish, onCancel, isDarkMode = false }) => {
  const [elapsed, setElapsed] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(Notification.permission === 'granted');
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<FiringLog['outcome']>('perfect');
  
  // Wake Lock State (螢幕恆亮狀態)
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Notification Settings
  const [showSettings, setShowSettings] = useState(false);
  const [thresholds, setThresholds] = useState<number[]>([50, 75, 90]);
  const [newThreshold, setNewThreshold] = useState('');
  
  // Track fired notifications
  const firedThresholdsRef = useRef<Set<number>>(new Set());
  const fired15MinRef = useRef(false);
  
  const totalEstimatedMs = schedule.estimatedDurationMinutes * 60 * 1000;
  
  // --- Wake Lock Logic (新增功能: 防止螢幕休眠) ---
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          setWakeLockActive(true);
          console.log('Wake Lock is active');
          
          wakeLockRef.current.addEventListener('release', () => {
            setWakeLockActive(false);
            console.log('Wake Lock released');
          });
        }
      } catch (err) {
        console.error('Wake Lock request failed:', err);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(console.error);
      }
    };
  }, []);

  // --- Temperature Calculation Logic ---
  const getCurrentTemp = (elapsedMs: number) => {
    const elapsedMinutes = elapsedMs / 60000;
    let currentT = 25;
    let timeAccumulator = 0;

    for (const seg of schedule.segments) {
      const segDuration = seg.type === 'hold' 
        ? seg.holdTime! 
        : (Math.abs(seg.targetTemp - currentT) / seg.rate!) * 60;

      if (timeAccumulator + segDuration > elapsedMinutes) {
        const timeInSeg = elapsedMinutes - timeAccumulator;
        if (seg.type === 'hold') return seg.targetTemp;
        
        const fraction = timeInSeg / segDuration;
        const tempDiff = seg.targetTemp - currentT;
        return Math.round(currentT + (tempDiff * fraction));
      }
      
      if (seg.type === 'ramp') {
        currentT = seg.targetTemp;
      }
      timeAccumulator += segDuration;
    }
    return currentT;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = now - startTime;
      setElapsed(diff);
      
      const currentProgress = (diff / totalEstimatedMs) * 100;
      const remainingMs = totalEstimatedMs - diff;
      const fifteenMinsMs = 15 * 60 * 1000;

      if (notificationsEnabled) {
        if (remainingMs > 0 && remainingMs <= fifteenMinsMs && !fired15MinRef.current) {
           new Notification("KilnMaster 通知", { body: "燒製即將完成（約剩餘 15 分鐘）。" });
           fired15MinRef.current = true;
        }

        thresholds.forEach(t => {
            if (currentProgress >= t && !firedThresholdsRef.current.has(t)) {
                const temp = getCurrentTemp(diff);
                new Notification("KilnMaster 進度通知", { 
                    body: `燒製進度已達 ${t}% (目前溫度約 ${temp}°C)` 
                });
                firedThresholdsRef.current.add(t);
            }
        });
      }

    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, totalEstimatedMs, notificationsEnabled, thresholds]);

  const requestNotification = () => {
    if (!("Notification" in window)) {
      alert("此瀏覽器不支援桌面通知");
    } else if (Notification.permission === "granted") {
      setNotificationsEnabled(true);
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          setNotificationsEnabled(true);
        }
      });
    }
  };

  const handleAddThreshold = () => {
    const val = parseInt(newThreshold);
    if (!isNaN(val) && val > 0 && val < 100 && !thresholds.includes(val)) {
        setThresholds([...thresholds, val]);
        setNewThreshold('');
    }
  };

  const handleRemoveThreshold = (val: number) => {
    setThresholds(thresholds.filter(t => t !== val));
    firedThresholdsRef.current.delete(val);
  };

  const progress = Math.min((elapsed / totalEstimatedMs) * 100, 100);
  const remainingMs = Math.max(0, totalEstimatedMs - elapsed);
  
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentTemp = getCurrentTemp(elapsed);

  const chartData = useMemo(() => {
    const points = calculateSchedulePoints(schedule.segments);
    return points.map(p => ({
      time: Math.round((p.time / 60) * 100) / 100, 
      temp: p.temp
    }));
  }, [schedule.segments]);

  const currentChartPoint = {
    time: Math.round((elapsed / 3600000) * 100) / 100,
    temp: currentTemp
  };

  const handleComplete = () => {
    onFinish({
        actualDuration: Math.round(elapsed / 60000),
        outcome,
        notes
    });
  };

  // Chart Colors
  const chartGridColor = isDarkMode ? '#44403c' : '#e5e7eb';
  const chartAxisColor = isDarkMode ? '#a8a29e' : '#9ca3af';
  const chartLineColor = isDarkMode ? '#78716c' : '#9ca3af'; // Slightly darker in light mode as requested, visible in dark
  const chartTooltipBg = isDarkMode ? '#292524' : '#fff';
  const chartTooltipBorder = isDarkMode ? '#57534e' : '#e5e7eb';

  if (showFinishModal) {
    return (
        <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-stone-900 rounded-2xl p-8 max-w-md w-full shadow-2xl transition-colors">
                <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-6">燒製報告</h2>
                
                <div className="mb-6">
                    <label className="block text-sm font-bold text-stone-600 dark:text-stone-400 mb-2">結果判定</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {['perfect', 'underfired', 'overfired', 'failure', 'error'].map((o) => (
                            <button
                                key={o}
                                onClick={() => setOutcome(o as FiringLog['outcome'])}
                                className={`p-2 rounded-lg border-2 text-sm font-bold transition-all ${
                                    outcome === o 
                                    ? 'border-clay-500 bg-clay-50 dark:bg-clay-900/50 text-clay-700 dark:text-clay-300' 
                                    : 'border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'
                                }`}
                            >
                                {{
                                    'perfect': '完美',
                                    'underfired': '溫度不足',
                                    'overfired': '過溫',
                                    'failure': '失敗',
                                    'error': '錯誤'
                                }[o]}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-bold text-stone-600 dark:text-stone-400 mb-2">備註</label>
                    <textarea 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="例如：釉藥效果很好、第2層溫度偏高等..."
                        className="w-full p-3 border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg h-24 focus:ring-2 focus:ring-clay-500 focus:outline-none"
                    />
                </div>

                <div className="flex gap-4">
                    <button 
                        onClick={() => setShowFinishModal(false)}
                        className="flex-1 py-3 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg font-bold"
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleComplete}
                        className="flex-1 py-3 bg-clay-600 hover:bg-clay-700 text-white rounded-lg font-bold shadow-lg"
                    >
                        儲存紀錄
                    </button>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 max-w-4xl mx-auto w-full">
      <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-xl w-full p-6 md:p-8 relative overflow-hidden transition-colors">
        {/* Background Pulse Animation */}
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-clay-300 via-clay-500 to-clay-300 animate-pulse`} />

        <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
              {schedule.name}
              {wakeLockActive ? (
                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-full flex items-center gap-1 font-normal">
                  <Zap className="w-3 h-3" /> 螢幕恆亮中
                </span>
              ) : (
                <span className="text-xs bg-stone-100 dark:bg-stone-800 text-stone-500 px-2 py-1 rounded-full flex items-center gap-1 font-normal" title="無法阻止螢幕休眠">
                  <ZapOff className="w-3 h-3" /> 一般模式
                </span>
              )}
            </h2>
            <p className="text-stone-500 dark:text-stone-400">開始時間：{new Date(startTime).toLocaleTimeString()}</p>
          </div>
          
          <div className="flex gap-2 self-end md:self-auto relative">
             {/* Notification Settings Button */}
             <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200' : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700'}`}
              title="通知設定"
            >
              <Settings className="w-6 h-6" />
            </button>

            {/* Notification Toggle Button */}
            <button 
              onClick={requestNotification}
              className={`p-2 rounded-full transition-colors ${notificationsEnabled ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700'}`}
              title={notificationsEnabled ? "通知已開啟" : "點擊開啟通知"}
            >
              {notificationsEnabled ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
            </button>

            {/* Settings Popover */}
            {showSettings && (
                <div className="absolute top-12 right-0 w-72 bg-white dark:bg-stone-800 rounded-xl shadow-xl border border-stone-100 dark:border-stone-700 p-4 z-20">
                    <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100 mb-3 flex items-center gap-2">
                        <Bell className="w-4 h-4" /> 自訂進度通知
                    </h3>
                    
                    <div className="flex gap-2 mb-4">
                        <div className="relative flex-1">
                            <input 
                                type="number" 
                                placeholder="%" 
                                className="w-full pl-3 pr-8 py-2 text-sm border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-clay-500"
                                value={newThreshold}
                                onChange={e => setNewThreshold(e.target.value)}
                                min="1"
                                max="99"
                            />
                            <span className="absolute right-3 top-2 text-stone-400 text-sm">%</span>
                        </div>
                        <button 
                            onClick={handleAddThreshold} 
                            disabled={!newThreshold}
                            className="bg-clay-600 text-white p-2 rounded-lg hover:bg-clay-700 disabled:opacity-50"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        <div className="text-xs text-stone-400 font-medium px-1">已設定的提醒點：</div>
                        {thresholds.sort((a,b)=>a-b).map(t => (
                            <div key={t} className="flex justify-between items-center bg-stone-50 dark:bg-stone-700/50 p-2 rounded-lg text-sm border border-stone-100 dark:border-stone-700">
                                <span className="font-mono font-bold text-clay-700 dark:text-clay-300">{t}%</span>
                                <button onClick={() => handleRemoveThreshold(t)} className="text-stone-400 hover:text-red-500 p-1">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <div className="flex justify-between items-center bg-stone-50 dark:bg-stone-700/50 p-2 rounded-lg text-sm border border-stone-100 dark:border-stone-700 opacity-75">
                             <span className="font-mono font-bold text-clay-700 dark:text-clay-300">倒數15分</span>
                             <span className="text-xs text-stone-400">(預設)</span>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left: Progress Circle */}
            <div className="flex flex-col items-center justify-center">
                <div className="relative w-56 h-56 mb-6">
                    <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="112"
                        cy="112"
                        r="100"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        className="text-stone-100 dark:text-stone-800"
                    />
                    <circle
                        cx="112"
                        cy="112"
                        r="100"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 100}
                        strokeDashoffset={2 * Math.PI * 100 * (1 - progress / 100)}
                        className="text-clay-500 transition-all duration-1000 ease-linear"
                        strokeLinecap="round"
                    />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1">剩餘時間</div>
                    <div className="text-3xl font-mono font-bold text-stone-800 dark:text-stone-100">
                        {formatTime(remainingMs)}
                    </div>
                    <div className="text-clay-600 dark:text-clay-400 font-bold mt-2 flex items-center gap-1 text-lg">
                        <Thermometer className="w-5 h-5" /> ~{Math.round(currentTemp)}°C
                    </div>
                    </div>
                </div>
            </div>

            {/* Right: Live Chart */}
            <div className="h-64 bg-stone-50 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 p-2 transition-colors">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
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
                            formatter={(val) => [`${val}°C`, '預定溫度']}
                            labelFormatter={(val) => `${val} 小時`}
                        />
                        <Line 
                            type="monotone" 
                            dataKey="temp" 
                            stroke={chartLineColor} 
                            strokeWidth={2} 
                            dot={false} 
                            name="預定曲線"
                        />
                        <ReferenceDot 
                            x={currentChartPoint.time} 
                            y={currentChartPoint.temp} 
                            r={6} 
                            fill="#b0776b" 
                            stroke="#fff" 
                            strokeWidth={2}
                        />
                        <ReferenceLine x={currentChartPoint.time} stroke="#b0776b" strokeDasharray="3 3" />
                    </LineChart>
                </ResponsiveContainer>
                <div className="text-center text-xs text-stone-400 mt-2">
                    實心點代表目前預估進度位置
                </div>
            </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => {
                if(confirm("中止燒製？點擊「確定」將進入結案報告（可標記為錯誤或中止），點擊「取消」繼續燒製。")) {
                    setOutcome('error');
                    setNotes('使用者手動中止');
                    setShowFinishModal(true);
                }
            }}
            className="flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-all font-bold"
          >
            <XCircle className="w-5 h-5" /> 中止燒製
          </button>
          <button
            onClick={() => {
                setOutcome('perfect');
                setShowFinishModal(true);
            }}
            className="flex items-center justify-center gap-2 py-4 rounded-xl bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl transition-all font-bold"
          >
            <CheckCircle className="w-5 h-5" /> 結束並紀錄
          </button>
        </div>
        
        <p className="text-center text-xs text-stone-400 mt-6">
          * 溫度顯示為根據排程的估算值，並非感測器實測數據。
        </p>
      </div>
    </div>
  );
};

export default ActiveFiring;