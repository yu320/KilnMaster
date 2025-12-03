
import { CalibrationResult, FiringLog } from "../types";

interface ApiResponse {
  status: 'success' | 'error';
  message?: string;
  data?: any;
}

export const loginToSheet = async (scriptUrl: string, username: string, password: string): Promise<boolean> => {
  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      body: JSON.stringify({ action: 'login', username, password }),
      // Google Apps Script text output handles CORS if deployed as "Anyone"
    });
    const result: ApiResponse = await response.json();
    return result.status === 'success';
  } catch (error) {
    console.error("Login failed", error);
    return false;
  }
};

export const fetchSheetData = async (scriptUrl: string): Promise<{ logs: FiringLog[], calibration: Partial<CalibrationResult> } | null> => {
  try {
    // fetch GET requires appending params to URL for GAS
    const url = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=getData`;
    const response = await fetch(url);
    const result: ApiResponse = await response.json();
    
    if (result.status === 'success' && result.data) {
      return result.data;
    }
    return null;
  } catch (error) {
    console.error("Fetch data failed", error);
    return null;
  }
};

export const saveLogToSheet = async (scriptUrl: string, log: FiringLog): Promise<boolean> => {
  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveLog', payload: log }),
    });
    const result: ApiResponse = await response.json();
    return result.status === 'success';
  } catch (error) {
    console.error("Save log failed", error);
    return false;
  }
};

export const saveCalibrationToSheet = async (scriptUrl: string, calibration: CalibrationResult): Promise<boolean> => {
  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveCalibration', payload: calibration }),
    });
    const result: ApiResponse = await response.json();
    return result.status === 'success';
  } catch (error) {
    console.error("Save calibration failed", error);
    return false;
  }
};
