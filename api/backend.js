/**
 * EmoGo Backend API
 * 含重試邏輯，適應 Render Free Plan 休眠問題
 */

import axios from 'axios';

// ========== 設定 ==========

const BACKEND_URL = 'https://emogo-backend-yessinea2025.onrender.com';
const API_TIMEOUT = 90000; // 90 秒（給 Render 喚醒時間）
const MAX_RETRIES = 2; // 最多重試 2 次

// ========== 工具函數 ==========

/**
 * 帶重試邏輯的 API 請求
 */
async function requestWithRetry(requestFn, retries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`🔄 重試第 ${attempt} 次...`);
        // 等待一下再重試（給 Render 時間喚醒）
        await new Promise(resolve => setTimeout(resolve, 5000)); // 等 5 秒
      }
      
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      // 如果是 timeout 或網路錯誤，可以重試
      if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
        if (attempt < retries) {
          console.log(`⚠️ 請求失敗（${error.message}），準備重試...`);
          continue;
        }
      } else {
        // 其他錯誤（如 4xx, 5xx）不重試
        throw error;
      }
    }
  }
  
  // 所有重試都失敗
  throw lastError;
}

// ========== API 函數 ==========

/**
 * 上傳情緒資料（含重試）
 */
export const uploadSentiment = async (emotion, score, note = '') => {
  try {
    console.log('📤 上傳情緒資料:', { emotion, score, note });
    
    const response = await requestWithRetry(async () => {
      return await axios.post(
        `${BACKEND_URL}/sentiments`,
        {
          emotion: emotion,
          score: score,
          note: note,
          timestamp: new Date().toISOString()
        },
        { timeout: API_TIMEOUT }
      );
    });
    
    console.log('✅ 情緒資料上傳成功:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ 情緒資料上傳失敗:', error.message);
    
    // 提供更友善的錯誤訊息
    let errorMessage = error.message;
    if (error.code === 'ECONNABORTED') {
      errorMessage = '伺服器回應超時，可能正在喚醒中。請稍後再試。';
    } else if (error.code === 'ERR_NETWORK') {
      errorMessage = '網路連接失敗，請檢查網路連接。';
    }
    
    return { success: false, error: errorMessage };
  }
};

/**
 * 上傳 GPS 座標（含重試）
 */
export const uploadGPS = async (latitude, longitude) => {
  try {
    console.log('📤 上傳 GPS 座標:', { latitude, longitude });
    
    const response = await requestWithRetry(async () => {
      return await axios.post(
        `${BACKEND_URL}/gps`,
        {
          latitude: latitude,
          longitude: longitude,
          timestamp: new Date().toISOString()
        },
        { timeout: API_TIMEOUT }
      );
    });
    
    console.log('✅ GPS 上傳成功:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ GPS 上傳失敗:', error.message);
    
    let errorMessage = error.message;
    if (error.code === 'ECONNABORTED') {
      errorMessage = '伺服器回應超時，請稍後再試。';
    } else if (error.code === 'ERR_NETWORK') {
      errorMessage = '網路連接失敗，請檢查網路連接。';
    }
    
    return { success: false, error: errorMessage };
  }
};

/**
 * 上傳影片（含重試）
 */
export const uploadVlog = async (videoUri, description = '') => {
  try {
    console.log('📤 準備上傳影片:', videoUri);
    
    // 建立 FormData
    const formData = new FormData();
    
    const filename = videoUri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `video/${match[1]}` : 'video/mp4';
    
    formData.append('file', {
      uri: videoUri,
      type: type,
      name: filename || `vlog_${Date.now()}.mp4`
    });
    
    if (description) {
      formData.append('description', description);
    }
    
    // 影片上傳通常較大，給更長的 timeout 但不重試（避免重複上傳）
    const response = await axios.post(
      `${BACKEND_URL}/vlogs`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2 分鐘
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          console.log(`📊 上傳進度: ${percentCompleted}%`);
        }
      }
    );
    
    console.log('✅ 影片上傳成功:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ 影片上傳失敗:', error.message);
    
    let errorMessage = error.message;
    if (error.code === 'ECONNABORTED') {
      errorMessage = '影片上傳超時，請檢查網路連接或稍後再試。';
    } else if (error.code === 'ERR_NETWORK') {
      errorMessage = '網路連接失敗，請檢查網路連接。';
    }
    
    return { success: false, error: errorMessage };
  }
};

/**
 * 上傳完整的每日記錄（含重試）
 */
export const uploadDailyLog = async (sentiment, latitude, longitude, videoUri, note = '') => {
  try {
    console.log('📤 開始上傳完整記錄...');
    
    const results = {
      sentiment: null,
      gps: null,
      vlog: null,
      success: false,
      errors: []
    };
    
    // 情緒類型映射
    const emotionMap = {
      1: 'very_sad',
      2: 'sad',
      3: 'neutral',
      4: 'happy',
      5: 'very_happy'
    };
    
    // 1. 上傳情緒資料（會自動重試）
    const sentimentResult = await uploadSentiment(
      emotionMap[sentiment] || 'neutral',
      sentiment,
      note
    );
    results.sentiment = sentimentResult;
    if (!sentimentResult.success) {
      results.errors.push('情緒資料上傳失敗');
    }
    
    // 2. 上傳 GPS（會自動重試）
    if (latitude && longitude) {
      const gpsResult = await uploadGPS(latitude, longitude);
      results.gps = gpsResult;
      if (!gpsResult.success) {
        results.errors.push('GPS 資料上傳失敗');
      }
    }
    
    // 3. 上傳影片（不重試，避免重複上傳大檔案）
    const vlogResult = await uploadVlog(
      videoUri,
      note || `${new Date().toLocaleDateString('zh-TW')} 的心情記錄`
    );
    results.vlog = vlogResult;
    if (!vlogResult.success) {
      results.errors.push('影片上傳失敗');
    }
    
    // 判斷整體是否成功
    results.success = results.errors.length === 0;
    
    if (results.success) {
      console.log('✅ 完整記錄上傳成功！');
    } else {
      console.warn('⚠️ 部分資料上傳失敗:', results.errors);
    }
    
    return results;
  } catch (error) {
    console.error('❌ 上傳記錄時發生錯誤:', error);
    return {
      success: false,
      errors: [error.message],
      sentiment: null,
      gps: null,
      vlog: null
    };
  }
};

/**
 * 測試後端連接（含喚醒功能）
 */
export const testConnection = async () => {
  try {
    console.log('🔍 測試後端連接:', BACKEND_URL);
    console.log('⏰ 如果伺服器休眠中，可能需要 30-60 秒喚醒...');
    
    const response = await axios.get(`${BACKEND_URL}/`, { timeout: 90000 }); // 給足夠時間喚醒
    
    console.log('✅ 後端連接成功:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ 後端連接失敗:', error.message);
    
    let errorMessage = error.message;
    if (error.code === 'ECONNREFUSED') {
      errorMessage = '無法連接到後端伺服器';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = '伺服器回應超時（可能正在喚醒或網路問題）';
    } else if (error.code === 'ERR_NETWORK') {
      errorMessage = '網路連接失敗，請檢查網路連接';
    }
    
    return { success: false, error: errorMessage };
  }
};

/**
 * 取得後端網址
 */
export const getBackendURL = () => {
  return BACKEND_URL;
};

export default {
  uploadSentiment,
  uploadGPS,
  uploadVlog,
  uploadDailyLog,
  testConnection,
  getBackendURL
};