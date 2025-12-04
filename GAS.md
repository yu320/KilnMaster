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
// 設定工作表名稱
const SHEET_LOGS = 'Logs';
const SHEET_CALIBRATION = 'Calibration';
const SHEET_USERS = 'Users';

// 初始化試算表 (如果第一次使用)
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. 設定 Logs 工作表
  let logsSheet = ss.getSheetByName(SHEET_LOGS);
  if (!logsSheet) {
    logsSheet = ss.insertSheet(SHEET_LOGS);
    // 欄位順序：ID, 排程名稱, 日期, 預估時間, 理論時間, 實際時間, 陶土重量, 結果, 備註
    logsSheet.appendRow(['ID', 'Schedule Name', 'Date', 'Predicted Duration', 'Theoretical Duration', 'Actual Duration', 'Clay Weight', 'Outcome', 'Notes']);
  } else {
    // 檢查並新增缺少的欄位 (向後相容)
    const headers = logsSheet.getRange(1, 1, 1, logsSheet.getLastColumn()).getValues()[0];
    if (headers.indexOf('Theoretical Duration') === -1) logsSheet.getRange(1, headers.length + 1).setValue('Theoretical Duration');
    // 重新讀取 headers 因為剛可能加了一欄
    const updatedHeaders = logsSheet.getRange(1, 1, 1, logsSheet.getLastColumn()).getValues()[0];
    if (updatedHeaders.indexOf('Clay Weight') === -1) logsSheet.getRange(1, updatedHeaders.length + 1).setValue('Clay Weight');
  }

  // 2. 設定 Calibration 工作表
  let calSheet = ss.getSheetByName(SHEET_CALIBRATION);
  if (!calSheet) {
    calSheet = ss.insertSheet(SHEET_CALIBRATION);
    calSheet.appendRow(['Factor', 'Advice', 'Last Updated']);
    calSheet.appendRow([1.0, '初始設定', new Date()]); // 預設值
  }

  // 3. 設定 Users 工作表
  let userSheet = ss.getSheetByName(SHEET_USERS);
  if (!userSheet) {
    userSheet = ss.insertSheet(SHEET_USERS);
    userSheet.appendRow(['Username', 'PasswordHash']); // 改為儲存 Hash
    // 預設 admin/admin123 的 SHA-256 Hash
    userSheet.appendRow(['admin', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3']);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'login') {
      // 這裡接收的 password 已經是前端 Hash 過的字串
      return handleLogin(data.username, data.password);
    }
    
    if (action === 'saveLog') {
      if (!isValidLog(data.payload)) {
        return responseJSON({ status: 'error', message: 'Invalid log data' });
      }
      return saveLog(data.payload);
    }

    if (action === 'saveCalibration') {
      return saveCalibration(data.payload);
    }

    return responseJSON({ status: 'error', message: 'Invalid action' });

  } catch (error) {
    return responseJSON({ status: 'error', message: error.toString() });
  }
}

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'getData') {
    return getCloudData();
  }
  return responseJSON({ status: 'success', message: 'KilnMaster AI API is running' });
}

// --- Handlers ---

function handleLogin(username, passwordHash) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    // 直接比對 Hash 值
    if (data[i][0] == username && data[i][1] == passwordHash) {
      return responseJSON({ status: 'success' });
    }
  }
  return responseJSON({ status: 'error', message: 'Invalid credentials' });
}

function getCloudData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logsSheet = ss.getSheetByName(SHEET_LOGS);
  const calSheet = ss.getSheetByName(SHEET_CALIBRATION);

  const logsData = logsSheet.getDataRange().getValues();
  const headers = logsData[0];
  const logs = [];
  const colMap = {};
  headers.forEach((h, i) => colMap[h] = i);

  for (let i = 1; i < logsData.length; i++) {
    const row = logsData[i];
    // 簡單防呆：確保日期存在
    if (row[colMap['Date']]) {
      logs.push({
        id: row[colMap['ID']],
        scheduleName: row[colMap['Schedule Name']],
        date: row[colMap['Date']],
        predictedDuration: Number(row[colMap['Predicted Duration']]),
        theoreticalDuration: colMap['Theoretical Duration'] !== undefined ? Number(row[colMap['Theoretical Duration']]) : null,
        actualDuration: Number(row[colMap['Actual Duration']]),
        clayWeight: colMap['Clay Weight'] !== undefined ? Number(row[colMap['Clay Weight']]) : 0,
        outcome: row[colMap['Outcome']],
        notes: row[colMap['Notes']]
      });
    }
  }

  const calData = calSheet.getDataRange().getValues();
  const lastCal = calData.length > 1 ? calData[calData.length - 1] : [1.0, 'No Data'];
  
  return responseJSON({ 
    status: 'success', 
    data: { 
      logs: logs,
      calibration: {
        factor: Number(lastCal[0]),
        advice: lastCal[1]
      }
    }
  });
}

function saveLog(log) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOGS);
  setupSpreadsheet(); // 確保欄位同步
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colMap = {};
  headers.forEach((h, i) => colMap[h] = i);

  const newRow = new Array(headers.length).fill('');
  newRow[colMap['ID']] = log.id;
  newRow[colMap['Schedule Name']] = log.scheduleName;
  newRow[colMap['Date']] = log.date;
  newRow[colMap['Predicted Duration']] = log.predictedDuration;
  if (colMap['Theoretical Duration'] !== undefined) newRow[colMap['Theoretical Duration']] = log.theoreticalDuration || '';
  newRow[colMap['Actual Duration']] = log.actualDuration;
  if (colMap['Clay Weight'] !== undefined) newRow[colMap['Clay Weight']] = log.clayWeight || 0;
  newRow[colMap['Outcome']] = log.outcome;
  newRow[colMap['Notes']] = log.notes;

  sheet.appendRow(newRow);
  return responseJSON({ status: 'success' });
}

function saveCalibration(cal) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CALIBRATION);
  sheet.appendRow([cal.factor, cal.advice, new Date()]);
  return responseJSON({ status: 'success' });
}

// --- Helpers ---

function isValidLog(log) {
  return log && log.scheduleName && log.date && typeof log.actualDuration === 'number';
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```
