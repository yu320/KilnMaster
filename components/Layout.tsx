import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Flame, History, LayoutDashboard, LogOut, RefreshCcw, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useKiln } from '../contexts/KilnContext';

interface Props {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const Layout: React.FC<Props> = ({ isDarkMode, toggleDarkMode }) => {
  const { username, logout } = useAuth();
  const { calibration, isLoadingData, refreshData, activeSchedule } = useKiln();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // NavLink 樣式輔助函式
  const navClass = ({ isActive }: { isActive: boolean }) => `
    flex-1 py-3 rounded-lg font-medium text-sm flex justify-center items-center gap-2 transition-all
    ${isActive 
      ? 'bg-stone-800 dark:bg-stone-700 text-white shadow-md' 
      : 'text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-200'}
  `;

  // 監控頁面特殊樣式 (如果有燒製中)
  const monitorClass = ({ isActive }: { isActive: boolean }) => `
    flex-1 py-3 rounded-lg font-medium text-sm flex justify-center items-center gap-2 transition-all
    ${isActive 
      ? 'bg-clay-600 text-white shadow-md' 
      : 'text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'}
  `;

  return (
    <div className={`min-h-screen bg-stone-100 dark:bg-stone-950 flex flex-col font-sans transition-colors duration-300 ${isDarkMode ? 'dark' : ''}`}>
      {/* Header */}
      <header className="bg-stone-900 dark:bg-black text-white pt-6 pb-16 px-6 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Flame className="w-64 h-64" />
        </div>
        <div className="max-w-5xl mx-auto flex justify-between items-center relative z-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-clay-100">KilnMaster AI</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-stone-400 text-sm">智慧陶藝電窯助手</span>
              <span className="bg-stone-800 dark:bg-stone-900 px-2 py-0.5 rounded text-xs text-stone-300 border border-stone-700">
                User: {username}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <div className="text-xs text-stone-500 uppercase tracking-widest">目前校正參數</div>
              <div className="text-xl font-mono text-clay-400 font-bold">
                {isLoadingData ? '...' : `${calibration.factor.toFixed(3)}x`}
              </div>
            </div>
            
            <button onClick={toggleDarkMode} className="p-2 text-stone-400 hover:text-yellow-400 dark:hover:text-blue-300 transition-colors">
              {isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            <button onClick={refreshData} className="p-2 text-stone-400 hover:text-white transition-colors">
              <RefreshCcw className={`w-5 h-5 ${isLoadingData ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleLogout} className="p-2 text-stone-400 hover:text-red-400 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 -mt-10 relative z-20 pb-12">
        {/* Navigation Tabs (Using Router NavLink) */}
        <nav className="bg-white dark:bg-stone-900 rounded-xl shadow-sm border border-stone-200 dark:border-stone-800 p-1.5 flex gap-1 mb-6 transition-colors">
          <NavLink to="/" className={navClass} end>
             <LayoutDashboard className="w-4 h-4" /> 排程與燒製
          </NavLink>
          
          <NavLink to="/monitor" className={monitorClass}>
            <Flame className="w-4 h-4" /> 監控進度
            {activeSchedule && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-1"></span>}
          </NavLink>
          
          <NavLink to="/history" className={navClass}>
            <History className="w-4 h-4" /> 歷史與校正
          </NavLink>
        </nav>

        {/* Page Content */}
        <div className="transition-opacity duration-300">
           <Outlet />
        </div>
      </main>

      <footer className="py-6 text-center text-stone-400 dark:text-stone-600 text-xs transition-colors">
        &copy; {new Date().getFullYear()} Youzih.KilnMaster AI.
      </footer>
    </div>
  );
};

export default Layout;