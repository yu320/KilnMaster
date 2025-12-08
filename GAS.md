# Google Apps Script (GAS) 更新指南

為了支援新的「陶土重量」功能，請將您的 Google Apps Script 專案中的 `Code.gs` (或主要腳本檔案) 替換為以下程式碼。

## 更新步驟

1.  開啟您的 Google Apps Script 專案。
2.  將現有的程式碼替換為下方的完整程式碼。
3.  點擊右上角的 **部署 (Deploy)** > **管理部署 (Manage deployments)**。
4.  點擊 **編輯 (Edit)** (鉛筆圖示)。
5.  在 **版本 (Version)** 下拉選單中選擇 **新版本 (New version)**。
6.  點擊 **部署 (Deploy)**。
    *   *注意：必須建立新版本，您的變更才會生效。*

---

## Code.gs

```javascript
// ==========================================
// 全域設定區 (工作表名稱)
// ==========================================
const SHEET_LOGS = 'Logs';
const SHEET_CALIBRATION = 'Calibration';
const SHEET_USERS = 'Users';
const SHEET_SETTINGS = 'Settings';
const SHEET_WEBHOOKS = 'Webhooks';
const SHEET_ACTIVE = 'ActiveFirings';
const SHEET_TEMPLATES = 'Templates';

// 機器人設定
const BOT_NAME = "KilnMaster AI";
const BOT_AVATAR = "https://cdn-icons-png.flaticon.com/512/3655/3655583.png";

// ==========================================
// 1. 初始化與 API 入口
// ==========================================

function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Logs (確保包含 Sample Type 與 Firing Stage)
  ensureSheet(ss, SHEET_LOGS, ['ID', 'Schedule Name', 'Date', 'Predicted Duration', 'Theoretical Duration', 'Actual Duration', 'Clay Weight', 'Sample Type', 'Firing Stage', 'Outcome', 'Notes']);

  // 2. Calibration
  let calSheet = ss.getSheetByName(SHEET_CALIBRATION);
  if (!calSheet) {
    calSheet = ss.insertSheet(SHEET_CALIBRATION);
    calSheet.appendRow(['Factor', 'Advice', 'Last Updated']);
    calSheet.appendRow([1.0, '初始設定', new Date()]);
  }

  // 3. Users
  ensureSheet(ss, SHEET_USERS, ['Username', 'PasswordHash']);
  const userSheet = ss.getSheetByName(SHEET_USERS);
  if (userSheet.getLastRow() < 2) {
     userSheet.appendRow(['admin', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3']);
  }

  // 4. Settings
  ensureSheet(ss, SHEET_SETTINGS, ['Key', 'Value']);

  // 5. ActiveFirings
  ensureSheet(ss, SHEET_ACTIVE, ['ID', 'ScheduleJson', 'StartTime', 'LastNotified', 'TotalDuration', 'Name']);

  // 6. Webhooks
  let whSheet = ss.getSheetByName(SHEET_WEBHOOKS);
  if (!whSheet) {
    whSheet = ss.insertSheet(SHEET_WEBHOOKS);
    whSheet.appendRow(['Name', 'URL', 'Enabled']);
    whSheet.appendRow(['預設頻道', '', 'TRUE']); 
  }

  // 7. Templates
  ensureSheet(ss, SHEET_TEMPLATES, ['Name', 'SegmentsJSON', 'LastUpdated']);
}

function ensureSheet(ss, name, headers) {
  if (!ss.getSheetByName(name)) {
    let sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
}

function doGet(e) {
  const action = e.parameter.action;
  if (!action || action === 'hash') return getHashToolHtml();
  if (action === 'getData') return getCloudData();
  if (action === 'getWebhooks') return getWebhooks();
  if (action === 'getSettings') return getSettings();
  if (action === 'getTemplates') return getTemplates();
  
  return responseJSON({ status: 'success', message: 'KilnMaster AI Cloud is running' });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'login') return handleLogin(data.username, data.password);
    if (action === 'saveLog') return saveLog(data.payload);
    if (action === 'saveCalibration') return saveCalibration(data.payload);
    if (action === 'saveTemplate') return saveTemplate(data.name, data.segments);
    if (action === 'saveSettings') return saveGlobalSettings(data.key || 'DiscordWebhook', data.value || data.webhook);
    if (action === 'saveWebhooks') return saveWebhooks(data.webhooks);
    if (action === 'startMonitor') return startCloudMonitor(data.payload);
    if (action === 'stopMonitor') return stopCloudMonitor(data.payload);
    if (action === 'sendDiscord') return broadcastDiscord(data.message);

    return responseJSON({ status: 'error', message: 'Invalid action' });
  } catch (error) {
    return responseJSON({ status: 'error', message: error.toString() });
  }
}

// ==========================================
// 2. 雲端監控核心
// ==========================================

function monitorFirings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ACTIVE);
  if (!sheet || sheet.getLastRow() < 2) return;

  const data = sheet.getDataRange().getValues();
  const now = Date.now();
  const websiteUrl = getGlobalSetting('WebsiteURL');

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const id = row[0];
    if (!id) continue;

    const schedule = JSON.parse(row[1]);
    const startTime = Number(row[2]);
    let lastNotified = Number(row[3]) || 0;
    const totalDurationMins = Number(row[4]);
    const name = row[5];

    const elapsedMs = now - startTime;
    const progress = (elapsedMs / (totalDurationMins * 60 * 1000)) * 100;
    const currentTemp = calculateTemperature(schedule, elapsedMs);
    const remainingMs = (totalDurationMins * 60 * 1000) - elapsedMs;

    let embed = null;
    let newNotifiedVal = lastNotified;

    // 進度通知
    const thresholds = [50, 75, 90];
    for (const t of thresholds) {
      if (progress >= t && lastNotified < t) {
        embed = {
          title: `🔥 燒製進度報告：${t}%`,
          url: websiteUrl,
          color: 16753920, 
          fields: [
            { name: "排程名稱", value: name, inline: true },
            { name: "目前估溫", value: `${currentTemp}°C`, inline: true },
            { name: "已用時間", value: formatTime(elapsedMs), inline: true },
            { name: "剩餘時間", value: formatTime(Math.max(0, remainingMs)), inline: true }
          ],
          footer: { text: "KilnMaster Cloud Monitor" },
          timestamp: new Date().toISOString()
        };
        newNotifiedVal = t;
      }
    }

    // 即將完成
    if (remainingMs > 0 && remainingMs <= 15 * 60 * 1000 && lastNotified < 95) {
      embed = {
        title: "⏰ 即將完成提醒",
        url: websiteUrl,
        description: "燒製行程預計在 15 分鐘內結束，請準備前往查看。",
        color: 16776960,
        fields: [
          { name: "排程名稱", value: name, inline: true },
          { name: "目前估溫", value: `${currentTemp}°C`, inline: true }
        ],
        timestamp: new Date().toISOString()
      };
      newNotifiedVal = 99;
    }

    // 超時
    if (remainingMs < -10 * 60 * 1000 && lastNotified < 100) {
       embed = {
        title: "✅ 預定時間已到",
        url: websiteUrl,
        description: "根據排程設定，燒製應已結束。請檢查電窯並在網頁紀錄結果。",
        color: 65280,
        fields: [
          { name: "排程名稱", value: name },
          { name: "總時長", value: formatTime(elapsedMs) }
        ],
        timestamp: new Date().toISOString()
       };
       newNotifiedVal = 100;
    }

    if (embed) {
      broadcastEmbed(embed);
      sheet.getRange(i + 1, 4).setValue(newNotifiedVal);
    }
  }
}

function startCloudMonitor(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ACTIVE);
  const { id, schedule, startTime } = payload;
  
  const scheduleJson = JSON.stringify(schedule);
  const totalDurationMins = schedule.estimatedDurationMinutes;
  
  sheet.appendRow([id, scheduleJson, startTime, 0, totalDurationMins, schedule.name]);
  
  const endTime = new Date(startTime + totalDurationMins * 60 * 1000);
  const endTimeStr = Utilities.formatDate(endTime, Session.getScriptTimeZone(), "HH:mm");
  const websiteUrl = getGlobalSetting('WebsiteURL');

  const embed = {
    title: "🚀 燒製排程已啟動",
    url: websiteUrl,
    description: "雲端監控已連線，系統將定時回報進度。",
    color: 3066993,
    fields: [
      { name: "排程名稱", value: schedule.name, inline: false },
      { name: "預估總時長", value: `${Math.floor(totalDurationMins / 60)}小時 ${totalDurationMins % 60}分`, inline: true },
      { name: "預計結束", value: `今日 ${endTimeStr}`, inline: true },
      { name: "樣品類型", value: schedule.sampleType || '一般', inline: true }
    ],
    timestamp: new Date().toISOString()
  };
  
  broadcastEmbed(embed);
  return responseJSON({ status: 'success' });
}

function stopCloudMonitor(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_ACTIVE);
  const id = payload.id;
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      sheet.deleteRow(i + 1);
      return responseJSON({ status: 'success' });
    }
  }
  return responseJSON({ status: 'success', message: 'ID not found but processed' });
}

// ==========================================
// 3. 資料存取
// ==========================================

function getCloudData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logsSheet = ss.getSheetByName(SHEET_LOGS);
  const calSheet = ss.getSheetByName(SHEET_CALIBRATION);
  
  const logsData = logsSheet.getDataRange().getValues();
  const logs = [];
  const colMap = {};
  logsData[0].forEach((h, i) => colMap[h] = i);
  
  for (let i = 1; i < logsData.length; i++) {
    const row = logsData[i];
    if (row[colMap['Date']]) {
      logs.push({
        id: row[colMap['ID']], 
        scheduleName: row[colMap['Schedule Name']], 
        date: row[colMap['Date']],
        predictedDuration: Number(row[colMap['Predicted Duration']]), 
        theoreticalDuration: Number(row[colMap['Theoretical Duration']]||0),
        actualDuration: Number(row[colMap['Actual Duration']]), 
        clayWeight: Number(row[colMap['Clay Weight']]||0),
        sampleType: row[colMap['Sample Type']] || 'standard', 
        firingStage: row[colMap['Firing Stage']] || 'uncertain', 
        outcome: row[colMap['Outcome']], 
        notes: row[colMap['Notes']]
      });
    }
  }
  const calData = calSheet.getDataRange().getValues();
  const lastCal = calData.length > 1 ? calData[calData.length - 1] : [1.0, 'Initial'];
  return responseJSON({ status: 'success', data: { logs: logs, calibration: { factor: Number(lastCal[0]), advice: lastCal[1] } } });
}

function saveLog(log) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  setupSpreadsheet();
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colMap = {};
  headers.forEach((h, i) => colMap[h] = i);
  
  const newRow = new Array(headers.length).fill('');
  
  const setVal = (key, val) => {
      if (colMap[key] !== undefined) newRow[colMap[key]] = val;
  }

  setVal('ID', log.id);
  setVal('Schedule Name', log.scheduleName);
  setVal('Date', log.date);
  setVal('Predicted Duration', log.predictedDuration);
  setVal('Theoretical Duration', log.theoreticalDuration || '');
  setVal('Actual Duration', log.actualDuration);
  setVal('Clay Weight', log.clayWeight || 0);
  setVal('Sample Type', log.sampleType || 'standard');
  setVal('Firing Stage', log.firingStage || 'uncertain'); 
  setVal('Outcome', log.outcome);
  setVal('Notes', log.notes);
  
  sheet.appendRow(newRow);
  return responseJSON({ status: 'success' });
}

// ==========================================
// 4. 其他功能
// ==========================================

function getWebhooks() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_WEBHOOKS);
  if (!sheet) return responseJSON({ status: 'success', data: [] });
  const data = sheet.getDataRange().getValues();
  const webhooks = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1]) {
      webhooks.push({ name: data[i][0], url: data[i][1], enabled: data[i][2] === true || data[i][2] === 'TRUE' });
    }
  }
  return responseJSON({ status: 'success', data: webhooks });
}

function saveWebhooks(webhookList) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_WEBHOOKS);
  if (!sheet) sheet = ss.insertSheet(SHEET_WEBHOOKS);
  
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).clearContent();
  
  if (webhookList && webhookList.length > 0) {
    const rows = webhookList.map(wh => [wh.name, wh.url, wh.enabled]);
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  }
  return responseJSON({ status: 'success' });
}

function broadcastEmbed(embedObject) {
  return sendToAllWebhooks({
    username: BOT_NAME,
    avatar_url: BOT_AVATAR,
    embeds: [embedObject]
  });
}

function broadcastDiscord(message) {
  return sendToAllWebhooks({ content: message });
}

function sendToAllWebhooks(payloadObj) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_WEBHOOKS);
  if (!sheet) return responseJSON({ status: 'error', message: 'No Webhook Config' });
  
  const data = sheet.getDataRange().getValues();
  const requests = [];
  
  for (let i = 1; i < data.length; i++) {
    const url = data[i][1];
    const enabled = data[i][2] === true || data[i][2] === 'TRUE';
    if (url && enabled) {
      requests.push({
        url: url, 
        method: 'post', 
        contentType: 'application/json',
        payload: JSON.stringify(payloadObj), 
        muteHttpExceptions: true
      });
    }
  }

  if (requests.length > 0) {
    try {
      UrlFetchApp.fetchAll(requests);
    } catch (e) {
      Logger.log("Broadcast Error: " + e.toString());
    }
  }
  return responseJSON({ status: 'success' });
}

function saveTemplate(name, segments) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_TEMPLATES);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_TEMPLATES);
    sheet.appendRow(['Name', 'SegmentsJSON', 'LastUpdated']);
  }

  const data = sheet.getDataRange().getValues();
  const jsonStr = JSON.stringify(segments);
  const timestamp = new Date();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      sheet.getRange(i + 1, 2).setValue(jsonStr);
      sheet.getRange(i + 1, 3).setValue(timestamp);
      return responseJSON({ status: 'success', message: 'Updated' });
    }
  }

  sheet.appendRow([name, jsonStr, timestamp]);
  return responseJSON({ status: 'success', message: 'Created' });
}

function getTemplates() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TEMPLATES);
  if (!sheet) return responseJSON({ status: 'success', data: [] });
  
  const data = sheet.getDataRange().getValues();
  const templates = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      try {
        templates.push({
          name: data[i][0],
          segments: JSON.parse(data[i][1])
        });
      } catch (e) {}
    }
  }
  return responseJSON({ status: 'success', data: templates });
}

function getGlobalSetting(key) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  if (!sheet) return '';
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return '';
}

function getSettings() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  const settings = {};
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if(data[i][0]) settings[data[i][0]] = data[i][1];
    }
  }
  return responseJSON({ status: 'success', data: settings });
}

function saveGlobalSettings(key, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SETTINGS);
    sheet.appendRow(['Key', 'Value']);
  }
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return responseJSON({ status: 'success' });
    }
  }
  sheet.appendRow([key, value]);
  return responseJSON({ status: 'success' });
}

function calculateTemperature(schedule, elapsedMs) {
  const elapsedMinutes = elapsedMs / 60000;
  let currentT = 25; 
  let timeAccumulator = 0;

  for (const seg of schedule.segments) {
    let segDuration = 0;
    if (seg.type === 'hold') {
      segDuration = seg.holdTime;
    } else {
      segDuration = (Math.abs(seg.targetTemp - currentT) / seg.rate) * 60;
    }

    if (timeAccumulator + segDuration > elapsedMinutes) {
      const timeInSeg = elapsedMinutes - timeAccumulator;
      if (seg.type === 'hold') return seg.targetTemp;
      const fraction = timeInSeg / segDuration;
      return Math.round(currentT + ((seg.targetTemp - currentT) * fraction));
    }
    
    if (seg.type === 'ramp') currentT = seg.targetTemp;
    timeAccumulator += segDuration;
  }
  return currentT;
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}時${m}分`;
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function handleLogin(username, passwordHash) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == username && data[i][1] == passwordHash) {
      return responseJSON({ status: 'success' });
    }
  }
  return responseJSON({ status: 'error' });
}

function saveCalibration(cal) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CALIBRATION);
  sheet.appendRow([cal.factor, cal.advice, new Date()]);
  return responseJSON({ status: 'success' });
}

function getHashToolHtml() {
  const html = `<!DOCTYPE html><html><head><base target="_top"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>KilnMaster Password</title><style>body{font-family:sans-serif;padding:20px;background:#f5f5f4;display:flex;justify-content:center}div{background:white;padding:2rem;border-radius:1rem;box-shadow:0 4px 6px -1px rgb(0 0 0/0.1)}input{width:100%;padding:10px;margin:10px 0;border:1px solid #ccc;border-radius:4px}button{width:100%;padding:10px;background:#b0776b;color:white;border:none;border-radius:4px;cursor:pointer}div.r{margin-top:20px;background:#333;color:#fff;padding:10px;border-radius:4px;word-break:break-all;font-family:monospace}</style></head><body><div><h2>密碼雜湊工具</h2><input id="p" placeholder="Password"><button onclick="g()">Generate</button><div id="o" class="r" style="display:none"></div></div><script>async function g(){const p=document.getElementById('p').value;if(!p)return;const d=new TextEncoder().encode(p);const h=await crypto.subtle.digest('SHA-256',d);const x=Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('');const o=document.getElementById('o');o.style.display='block';o.innerText=x;}</script></body></html>`;
  return HtmlService.createHtmlOutput(html).setTitle('KilnMaster Password').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
```
