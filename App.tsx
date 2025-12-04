import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import ScheduleEditor from './components/ScheduleEditor';
import ActiveFiring from './components/ActiveFiring';
import HistoryLogView from './components/HistoryLog';
import Settings from './components/Settings';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { KilnProvider, useKiln } from './contexts/KilnContext';
import { FiringLog, calculateTheoreticalDuration } from './types';

// 保護路由元件：未登入時顯示登入畫面，已登入顯示子元件
const ProtectedRoute: React.FC<{ children: React.ReactNode, isDarkMode: boolean, toggleDarkMode: () => void }> = ({ children, isDarkMode, toggleDarkMode }) => {
  const { isAuthenticated, login } = useAuth();
  
  if (!isAuthenticated) {
    return (
      <Login 
        onLogin={login} 
        isDarkMode={isDarkMode} 
        onToggleDarkMode={toggleDarkMode} 
      />
    );
  }
  return <>{children}</>;
};

// 燒製監控頁面 Wrapper (連接 Context 與 Component)
const MonitorPage = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const { activeSchedule, startTime, cancelFiring, finishFiring, addLog } = useKiln();
  const navigate = useNavigate();

  const handleFinish = async (result: Pick<FiringLog, 'actualDuration' | 'outcome' | 'notes'>) => {
    if (!activeSchedule) return;

    const newLog: FiringLog = {
      id: crypto.randomUUID(),
      scheduleName: activeSchedule.name,
      date: new Date().toISOString(),
      predictedDuration: activeSchedule.estimatedDurationMinutes,
      actualDuration: result.actualDuration,
      clayWeight: activeSchedule.clayWeight,
      notes: result.notes,
      outcome: result.outcome,
      // 計算理論時間作為參考
      theoreticalDuration: calculateTheoreticalDuration(activeSchedule.segments)
    };

    // 新增紀錄並同步到雲端
    await addLog(newLog);
    
    // 清除燒製狀態並導向歷史頁面
    finishFiring();
    navigate('/history');
  };

  // 若無進行中的燒製，顯示提示並導回首頁或顯示訊息
  if (!activeSchedule || !startTime) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6 border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-xl m-4">
        <p className="text-stone-500 dark:text-stone-400 mb-4">目前沒有進行中的燒製排程。</p>
        <button 
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-clay-600 text-white rounded-lg hover:bg-clay-700 transition-colors"
        >
          前往建立排程
        </button>
      </div>
    );
  }

  return (
    <ActiveFiring 
      schedule={activeSchedule} 
      startTime={startTime} 
      onFinish={handleFinish}
      onCancel={() => { 
        cancelFiring(); 
        navigate('/'); 
      }}
      isDarkMode={isDarkMode}
    />
  );
};

// 排程頁面 Wrapper
const PlanPage = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const { startFiring, calibration } = useKiln();
  const navigate = useNavigate();
  
  return (
    <ScheduleEditor 
      onStartFiring={(schedule) => {
        startFiring(schedule);
        navigate('/monitor');
      }} 
      calibrationFactor={calibration.factor}
      isDarkMode={isDarkMode}
    />
  );
};

// 歷史頁面 Wrapper
const HistoryPage = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const { logs, calibration, updateCalibration } = useKiln();
  
  return (
    <HistoryLogView 
      logs={logs} 
      calibration={calibration} 
      onUpdateCalibration={updateCalibration} 
      isDarkMode={isDarkMode} 
    />
  );
};

function App() {
  // 初始化 Dark Mode (讀取 localStorage)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // 監聽 Dark Mode 變更並套用至 HTML 標籤
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  return (
    <BrowserRouter>
      <AuthProvider>
        <KilnProvider>
          <Routes>
            {/* 受保護的路由區域 */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode}>
                  <Layout isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
                </ProtectedRoute>
              }
            >
              <Route index element={<PlanPage isDarkMode={isDarkMode} />} />
              <Route path="monitor" element={<MonitorPage isDarkMode={isDarkMode} />} />
              <Route path="history" element={<HistoryPage isDarkMode={isDarkMode} />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* 處理未知路徑，導向首頁 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </KilnProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;