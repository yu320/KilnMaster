import React, { useState } from 'react';
import { MessageSquare, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Settings: React.FC = () => {
  const { discordWebhook, updateWebhook } = useAuth();
  const [localWebhook, setLocalWebhook] = useState(discordWebhook);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const handleSave = async () => {
    setStatus('saving');
    const success = await updateWebhook(localWebhook);
    if (success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setStatus('error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white dark:bg-stone-900 rounded-xl shadow-sm border border-stone-200 dark:border-stone-800 p-6 transition-colors">
        <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-6 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-clay-500" />
          通知設定
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">
              Discord Webhook URL
            </label>
            <input
              type="text"
              value={localWebhook}
              onChange={(e) => setLocalWebhook(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full p-3 border border-stone-300 dark:border-stone-700 rounded-lg bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-clay-500 outline-none transition-all"
            />
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
              設定後，系統會將燒製進度與完成通知發送至您的 Discord 頻道。
              設定將儲存於 Google 試算表 (後端) 中，更換裝置時會自動載入。
            </p>
          </div>

          <div className="pt-4 flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={status === 'saving'}
              className="flex items-center gap-2 px-6 py-3 bg-clay-600 hover:bg-clay-700 text-white rounded-lg font-bold transition-all disabled:opacity-50"
            >
              {status === 'saving' ? '儲存中...' : (
                <>
                  <Save className="w-4 h-4" /> 儲存設定
                </>
              )}
            </button>

            {status === 'success' && (
              <span className="text-green-600 dark:text-green-400 flex items-center gap-1 text-sm font-bold animate-fade-in">
                <CheckCircle className="w-4 h-4" /> 儲存成功
              </span>
            )}
            {status === 'error' && (
              <span className="text-red-600 dark:text-red-400 flex items-center gap-1 text-sm font-bold animate-fade-in">
                <AlertCircle className="w-4 h-4" /> 儲存失敗
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;