// 匯出資料為 JSON
  const exportDataAsJSON = async () => {
    try {
      const logs = await getAllDailyLogs();

      if (logs.length === 0) {
        Alert.alert("無資料", "目前沒有可匯出的資料");
        return;
      }

      const json = JSON.stringify(logs, null, 2);
      const fileUri = FileSystem.documentDirectory + "daily_logs.json";
      await FileSystem.writeAsStringAsync(fileUri, json);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/json",
          dialogTitle: "匯出每日記錄",
        });
      } else {
        Alert.alert("✅ 成功", `資料已儲存至：${fileUri}`);
      }
    } catch (err) {
      console.error("Export error:", err);
      Alert.alert("❌ 匯出失敗", "資料匯出時發生錯誤");
    }
  };import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Platform,
  Modal,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { getAllDailyLogs } from "../../database/db";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { testConnection, getBackendURL } from '../../api/backend';

// 設定通知處理器
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // 已棄用但保留以兼容
    shouldShowBanner: true, // 新版 API
    shouldShowList: true,   // 新版 API
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const STORAGE_KEY = "@notification_times";

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationTimes, setNotificationTimes] = useState([
    { id: 1, time: "09:00", enabled: true },
    { id: 2, time: "14:00", enabled: true },
    { id: 3, time: "20:00", enabled: true },
  ]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("AM");
  const [selectedHour, setSelectedHour] = useState("9");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [isTestingConnection, setIsTestingConnection] = useState(false);


  useEffect(() => {
    checkNotificationPermission();
    loadSavedTimes();
    setupNotificationChannel();
    // 移除自動重新排程 - 改為只在使用者手動設定時才排程
  }, []);

  // 設定 Android 通知頻道
  const setupNotificationChannel = async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily-reminders', {
        name: '每日提醒',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF3B30',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        bypassDnd: true,
      });
      console.log('✅ Notification channel created');
    }
  };

  // 載入儲存的時間設定
  const loadSavedTimes = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setNotificationTimes(JSON.parse(saved));
      }
    } catch (err) {
      console.error("Error loading saved times:", err);
    }
  };

  // 儲存時間設定
  const saveTimes = async (times) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(times));
    } catch (err) {
      console.error("Error saving times:", err);
    }
  };

  // 檢查通知權限
  const checkNotificationPermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(status === "granted");
  };

  // 請求通知權限（已不需要，合併到 toggleNotifications）

  // 驗證時間格式 (HH:MM)
  const isValidTime = (time) => {
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(time);
  };

  // 排程所有通知（簡化版）
  const scheduleAllNotifications = async () => {
    try {
      const now = new Date();
      
      // 先取消所有現有通知
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      // 等待系統清除
      await new Promise(resolve => setTimeout(resolve, 1000));

      const scheduledNotifications = [];
      
      console.log("=== Scheduling notifications ===");
      console.log("Current time:", now.toLocaleString('zh-TW'));

      // 為每個啟用的時間設定通知
      for (const timeSlot of notificationTimes) {
        if (timeSlot.enabled) {
          const [hour, minute] = timeSlot.time.split(":").map(Number);
          
          // 使用正確的 trigger 格式
          const triggerId = await Notifications.scheduleNotificationAsync({
            content: {
              title: "📝 記錄時間到了！",
              body: "該記錄今天的心情和拍攝 vlog 囉～",
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
              vibrate: [0, 250, 250, 250],
              ...(Platform.OS === 'android' && {
                channelId: 'daily-reminders',
              }),
            },
            trigger: {
              type: 'daily',
              hour: hour,
              minute: minute,
            },
          });

          console.log(`  Trigger ID: ${triggerId}`);

          scheduledNotifications.push({ 
            time: timeSlot.time, 
          });
        }
      }

      console.log("\n=== Scheduling complete ===");

      // 排序通知時間（最近的在前）
      //scheduledNotifications.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      if (scheduledNotifications.length > 0) {
        // 只顯示通知時間
        const timeList = scheduledNotifications
          .map((n, index) => `${index + 1}. 每天 ${n.time}`)
          .join('\n');
        
        Alert.alert(
          "✅ 通知已設定", 
          `排定的通知時間：\n${timeList}`
        );
      }
    } catch (err) {
      console.error("❌ Error scheduling notifications:", err);
      Alert.alert("設定失敗", `錯誤：${err.message}`);
    }
  };

  // 切換通知開關
  const toggleNotifications = async (value) => {
    if (value) {
      // 請求權限
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        setNotificationsEnabled(true);
        // 開啟時顯示提示（silent = false）
        await scheduleAllNotifications();
      } else {
        Alert.alert("❌ 失敗", "需要通知權限才能提醒您收集資料");
      }
    } else {
      await Notifications.cancelAllScheduledNotificationsAsync();
      setNotificationsEnabled(false);
      //Alert.alert("通知已關閉", "所有提醒已取消");
    }
  };

  // 切換特定時間的通知
  const toggleTimeSlot = async (id) => {
    const updated = notificationTimes.map((slot) =>
      slot.id === id ? { ...slot, enabled: !slot.enabled } : slot
    );
    
    // 檢查是否有任何開關被打開
    const toggledSlot = updated.find(slot => slot.id === id);
    const wasEnabled = !toggledSlot.enabled; // 因為已經切換了，所以反過來
    const isNowEnabled = toggledSlot.enabled;
    
    setNotificationTimes(updated);
    await saveTimes(updated);

    if (notificationsEnabled) {
      // 如果是打開開關，顯示提示；關閉則靜默
      const shouldShowAlert = isNowEnabled;
      await scheduleNotificationsWithTimes(updated, !shouldShowAlert);
    }
  };

  // 開始編輯時間
  const startEditing = (id, currentTime) => {
    setEditingId(id);
    
    // 解析現有時間 (HH:MM 24小時制)
    const [hour24, minute] = currentTime.split(":").map(Number);
    
    // 轉換為 12 小時制
    const period = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    
    setSelectedPeriod(period);
    setSelectedHour(hour12.toString());
    setSelectedMinute(minute.toString().padStart(2, '0'));
    setShowTimePicker(true);
  };

  // 儲存編輯的時間
  const saveEditedTime = async () => {
    try {
      // 轉換為 24 小時制
      let hour24 = parseInt(selectedHour);
      if (selectedPeriod === "PM" && hour24 !== 12) {
        hour24 += 12;
      } else if (selectedPeriod === "AM" && hour24 === 12) {
        hour24 = 0;
      }

      const newTime = `${hour24.toString().padStart(2, '0')}:${selectedMinute}`;

      // 更新時間，並且自動開啟該時間的通知開關
      const updated = notificationTimes.map((slot) =>
        slot.id === editingId ? { ...slot, time: newTime, enabled: true } : slot
      );
      
      setNotificationTimes(updated);
      await saveTimes(updated);
      setShowTimePicker(false);
      setEditingId(null);

      console.log(`✅ Time updated to ${newTime}, notification enabled for this slot`);

      // 如果總開關已開啟，顯示提示（因為開關被打開了）
      if (notificationsEnabled) {
        await scheduleNotificationsWithTimes(updated, false); // false = 顯示提示
      }
    } catch (err) {
      console.error("Error saving time:", err);
      Alert.alert("儲存失敗", "時間設定時發生錯誤");
    }
  };

  // 用指定的時間列表排程通知
  const scheduleNotificationsWithTimes = async (times, silent = false) => {
    try {
      const now = new Date();
      
      // 取消所有現有通知
      await Notifications.cancelAllScheduledNotificationsAsync();
      await new Promise(resolve => setTimeout(resolve, 1000)); // 增加等待時間

      const scheduledNotifications = [];

      console.log("=== Scheduling notifications ===");
      console.log("Current time:", now.toLocaleString('zh-TW'));

      // 為每個啟用的時間設定通知
      for (const timeSlot of times) {
        if (timeSlot.enabled) {
          const [hour, minute] = timeSlot.time.split(":").map(Number);
          
          // 使用正確的 trigger 格式
          const triggerId = await Notifications.scheduleNotificationAsync({
            content: {
              title: "📝 記錄時間到了！",
              body: "該記錄今天的心情和拍攝 vlog 囉～",
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
              vibrate: [0, 250, 250, 250],
              ...(Platform.OS === 'android' && {
                channelId: 'daily-reminders',
              }),
            },
            trigger: {
              type: 'daily',
              hour: hour,
              minute: minute,
            },
          });

          console.log(`  Trigger ID: ${triggerId}`);

          scheduledNotifications.push({ 
            time: timeSlot.time, 
          });
        }
      }

      console.log("\n=== Scheduling complete ===");

      // 排序並顯示（只有在非靜默模式才顯示）
      if (!silent) {
        //scheduledNotifications.sort((a, b) => a.date.getTime() - b.date.getTime());
        scheduledNotifications.sort((a, b) => a.time.localeCompare(b.time));
        if (scheduledNotifications.length > 0) {
          const timeList = scheduledNotifications
            .map((n, index) => `${index + 1}. 每天 ${n.time}`)
            .join('\n');
          
          Alert.alert(
            "✅ 通知已更新", 
            `排定的通知時間：\n${timeList}`
          );
        }
      }
    } catch (err) {
      console.error("❌ Scheduling error:", err);
      if (!silent) {
        Alert.alert("排程錯誤", `${err.message}\n\n請重新設定通知`);
      }
    }
  };

  // 取消編輯
  const cancelEditing = () => {
    setShowTimePicker(false);
    setEditingId(null);
  };

  // 匯出資料為 CSV
  const exportDataAsCSV = async () => {
    try {
      const logs = await getAllDailyLogs();

      if (logs.length === 0) {
        Alert.alert("無資料", "目前沒有可匯出的資料");
        return;
      }

      // 建立 CSV 內容（加入 BOM 以支援 Excel 開啟中文）
      let csv = "\uFEFF"; // UTF-8 BOM
      csv += "ID,Timestamp_UTC,Timestamp_Taiwan,Sentiment,Latitude,Longitude,Vlog_URI\n";
      
      logs.forEach((log) => {
        // 處理可能的 null 值和特殊字元
        const id = log.id || "";
        
        // 處理 timestamp - 轉換為台灣時間
        let timestampUTC = "";
        let timestampTaiwan = "";
        if (log.timestamp) {
          timestampUTC = `"${log.timestamp}"`;
          
          // 轉換為台灣時間（UTC+8）
          const date = new Date(log.timestamp);
          const taiwanTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));
          timestampTaiwan = `"${taiwanTime.toISOString().replace('T', ' ').substring(0, 19)}"`;
        }
        
        const sentiment = log.sentiment !== null && log.sentiment !== undefined ? log.sentiment : "";
        const lat = log.lat !== null && log.lat !== undefined ? log.lat : "";
        const lng = log.lng !== null && log.lng !== undefined ? log.lng : "";
        const vlog = log.vlog_uri ? `"${log.vlog_uri.replace(/"/g, '""')}"` : ""; // 處理雙引號
        
        csv += `${id},${timestampUTC},${timestampTaiwan},${sentiment},${lat},${lng},${vlog}\n`;
      });

      // 產生檔名（包含日期時間 - 使用台灣時間）
      const now = new Date();
      const taiwanNow = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      const dateStr = taiwanNow.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = taiwanNow.toISOString().split('T')[1].substring(0, 8).replace(/:/g, '-'); // HH-MM-SS
      const fileName = `daily_logs_${dateStr}_${timeStr}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;

      // 寫入檔案
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: "utf8",
      });

      console.log("✅ CSV exported to:", fileUri);
      console.log("Total records:", logs.length);

      // 詢問使用者要下載還是分享
      Alert.alert(
        "匯出成功",
        `已建立 CSV 檔案\n共 ${logs.length} 筆記錄\n\n請選擇操作：`,
        [
          {
            text: "📥 儲存到資料夾",
            onPress: () => saveToDownloads(fileUri, fileName),
          },
          {
            text: "📤 分享檔案",
            onPress: () => shareFile(fileUri, fileName, logs.length),
          },
          {
            text: "取消",
            style: "cancel",
          },
        ]
      );
    } catch (err) {
      console.error("❌ Export error:", err);
      Alert.alert("❌ 匯出失敗", `錯誤訊息：${err.message || "未知錯誤"}`);
    }
  };

  // 儲存到下載資料夾（使用 SAF 讓使用者選擇）
  const saveToDownloads = async (sourceUri, fileName) => {
    try {
      if (Platform.OS === "android") {
        // 先顯示說明
        Alert.alert(
          "📁 選擇儲存位置",
          "Android 安全限制：\n\n• 無法直接存取現有的 Download 資料夾\n• 請建立新資料夾或選擇其他位置\n\n建議：\n1. 點「新增資料夾」\n2. 命名為「DailyLogs」或其他名稱\n3. 選擇該資料夾儲存",
          [
            {
              text: "我知道了",
              onPress: async () => {
                try {
                  // 讀取 CSV 內容
                  const csvContent = await FileSystem.readAsStringAsync(sourceUri);
                  
                  // 使用 Storage Access Framework 讓使用者選擇儲存位置
                  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                  
                  if (!permissions.granted) {
                    Alert.alert(
                      "已取消",
                      "您可以改用「分享檔案」功能",
                      [
                        {
                          text: "開啟分享",
                          onPress: () => shareFile(sourceUri, fileName, 0),
                        },
                        { text: "關閉", style: "cancel" },
                      ]
                    );
                    return;
                  }

                  // 在使用者選擇的目錄中建立檔案
                  const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                    permissions.directoryUri,
                    fileName,
                    'text/csv'
                  );
                  
                  // 寫入內容
                  await FileSystem.writeAsStringAsync(fileUri, csvContent);
                  
                  Alert.alert(
                    "✅ 儲存成功",
                    `檔案已儲存\n${fileName}`,
                    [{ text: "確定" }]
                  );
                } catch (err) {
                  console.error("❌ Save error:", err);
                  Alert.alert(
                    "❌ 儲存失敗",
                    `錯誤訊息：${err.message}\n\n建議使用「📤 分享檔案」功能`,
                    [
                      {
                        text: "開啟分享",
                        onPress: () => shareFile(sourceUri, fileName, 0),
                      },
                      { text: "關閉", style: "cancel" },
                    ]
                  );
                }
              }
            },
            {
              text: "改用分享",
              onPress: () => shareFile(sourceUri, fileName, 0),
            }
          ]
        );
      } else {
        // iOS: 使用分享
        Alert.alert(
          "提示",
          "iOS 裝置請使用「分享檔案」選項",
          [
            {
              text: "開啟分享",
              onPress: () => shareFile(sourceUri, fileName, 0),
            },
            { text: "取消", style: "cancel" },
          ]
        );
      }
    } catch (err) {
      console.error("❌ Save error:", err);
      Alert.alert(
        "❌ 儲存失敗",
        `錯誤訊息：${err.message}\n\n建議使用「📤 分享檔案」功能`,
        [
          {
            text: "開啟分享",
            onPress: () => shareFile(sourceUri, fileName, 0),
          },
          { text: "關閉", style: "cancel" },
        ]
      );
    }
  };

  // 分享檔案
  const shareFile = async (fileUri, fileName, recordCount) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: `匯出每日記錄 (${recordCount} 筆)`,
          UTI: "public.comma-separated-values-text",
        });
      } else {
        Alert.alert(
          "✅ 檔案已建立",
          `檔案路徑：\n${fileUri}\n\n檔名：${fileName}`
        );
      }
    } catch (err) {
      console.error("❌ Share error:", err);
      Alert.alert("❌ 分享失敗", `錯誤訊息：${err.message || "未知錯誤"}`);
    }
  };

  // 匯出資料為 JSON
  const exportDataAsJSON = async () => {
    try {
      const logs = await getAllDailyLogs();

      if (logs.length === 0) {
        Alert.alert("無資料", "目前沒有可匯出的資料");
        return;
      }

      const json = JSON.stringify(logs, null, 2);
      const fileUri = FileSystem.documentDirectory + "daily_logs.json";
      await FileSystem.writeAsStringAsync(fileUri, json);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/json",
          dialogTitle: "匯出每日記錄",
        });
      } else {
        Alert.alert("✅ 成功", `資料已儲存至：${fileUri}`);
      }
    } catch (err) {
      console.error("Export error:", err);
      Alert.alert("❌ 匯出失敗", "資料匯出時發生錯誤");
    }
  };


  // 測試通知
  const testNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🔔 測試通知",
          body: "這是一個測試通知！如果您看到這個，代表通知功能正常",
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          ...(Platform.OS === 'android' && {
            channelId: 'daily-reminders',
          }),
        },
        trigger: {
          seconds: 2,
        },
      });
      Alert.alert("測試通知", "將在 2 秒後顯示通知\n\n如果沒有看到通知，請檢查：\n1. 通知權限是否開啟\n2. 請勿打擾模式是否關閉\n3. 電池優化設定");
    } catch (err) {
      console.error("Test notification error:", err);
      Alert.alert("測試失敗", `通知測試時發生錯誤：${err.message}`);
    }
  };

  // 測試後端連接
  const testBackendConnection = async () => {
    setIsTestingConnection(true);
    const result = await testConnection();
    setIsTestingConnection(false);

    if (result.success) {
      Alert.alert(
        '✅ 連接成功',
        `成功連接到後端伺服器！`
      );
    } else {
      Alert.alert(
        '❌ 連接失敗',
        result.error || '無法連接到後端伺服器'
      );
    }
  };
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>設定</Text>

      {/* 通知設定 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 每日提醒</Text>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>啟用通知</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
          />
        </View>

        {notificationsEnabled && (
          <>
            <Text style={styles.subsectionTitle}>提醒時間（點擊時間可編輯）</Text>
            {notificationTimes.map((slot) => (
              <View key={slot.id} style={styles.timeSlotRow}>
                <TouchableOpacity
                  onPress={() => startEditing(slot.id, slot.time)}
                >
                  <Text style={styles.timeText}>⏰ {slot.time}</Text>
                </TouchableOpacity>
                <Switch
                  value={slot.enabled}
                  onValueChange={() => toggleTimeSlot(slot.id)}
                />
              </View>
            ))}

            <TouchableOpacity
              style={styles.testButton}
              onPress={testNotification}
            >
              <Text style={styles.testButtonText}> 測試通知功能</Text>
            </TouchableOpacity>

          </>
        )}
      </View>

      {/* 測試後端連接 */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.testConnectionButton}
          onPress={testBackendConnection}
          disabled={isTestingConnection}
        >
          <Text style={styles.testConnectionButtonText}>
            {isTestingConnection ? '測試中...' : '🔍 測試後端連接'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 資料匯出 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💾 資料匯出</Text>

        <TouchableOpacity style={styles.exportButton} onPress={exportDataAsCSV}>
          <Text style={styles.exportButtonText}> 匯出為 CSV 檔案</Text>
        </TouchableOpacity>

        <Text style={styles.exportHint}>
          💡 CSV 格式可用 Excel 或 Google Sheets 開啟
        </Text>
      </View>

      {/* 說明 */}
      <View style={styles.infoBox}>
    
        <Text style={styles.infoText}>
          💡 如果通知無法正常運作，請檢查：
        </Text>
        <Text style={styles.infoText}>
          　• 手機通知權限是否開啟
        </Text>
        <Text style={styles.infoText}>
          　• 請勿打擾模式是否關閉
        </Text>
        <Text style={styles.infoText}>
          　• 電池優化設定（建議關閉此 app 的電池優化）
        </Text>
      </View>

      {/* 時間選擇器 Modal */}
      <Modal
        visible={showTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={cancelEditing}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>選擇時間</Text>
            
            <View style={styles.pickerRow}>
              {/* 上午/下午 */}
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>上午/下午</Text>
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[styles.optionButton, selectedPeriod === "AM" && styles.optionButtonActive]}
                    onPress={() => setSelectedPeriod("AM")}
                  >
                    <Text style={[styles.optionText, selectedPeriod === "AM" && styles.optionTextActive]}>
                      上午
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.optionButton, selectedPeriod === "PM" && styles.optionButtonActive]}
                    onPress={() => setSelectedPeriod("PM")}
                  >
                    <Text style={[styles.optionText, selectedPeriod === "PM" && styles.optionTextActive]}>
                      下午
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 小時 */}
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>小時</Text>
                <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={true}>
                  {[...Array(12)].map((_, i) => {
                    const hour = (i + 1).toString();
                    return (
                      <TouchableOpacity
                        key={hour}
                        style={[styles.scrollOption, selectedHour === hour && styles.scrollOptionActive]}
                        onPress={() => setSelectedHour(hour)}
                      >
                        <Text style={[styles.scrollOptionText, selectedHour === hour && styles.scrollOptionTextActive]}>
                          {hour}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* 分鐘 */}
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>分鐘</Text>
                <ScrollView style={styles.scrollPicker} showsVerticalScrollIndicator={true}>
                  {[...Array(60)].map((_, i) => {
                    const minute = i.toString().padStart(2, '0');
                    return (
                      <TouchableOpacity
                        key={minute}
                        style={[styles.scrollOption, selectedMinute === minute && styles.scrollOptionActive]}
                        onPress={() => setSelectedMinute(minute)}
                      >
                        <Text style={[styles.scrollOptionText, selectedMinute === minute && styles.scrollOptionTextActive]}>
                          {minute}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={cancelEditing}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={saveEditedTime}
              >
                <Text style={styles.modalButtonText}>確定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
    color: "#333",
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
    color: "#666",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: "#333",
  },
  timeSlotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    marginBottom: 8,
  },
  timeText: {
    fontSize: 16,
    color: "#333",
  },
  editContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeInput: {
    flex: 1,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#007AFF",
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: "#34C759",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  cancelButton: {
    backgroundColor: "#FF3B30",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  testButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    alignItems: "center",
  },
  testButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  exportButton: {
    padding: 16,
    backgroundColor: "#34C759",
    borderRadius: 8,
    alignItems: "center",
  },
  exportButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  exportHint: {
    fontSize: 13,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  testConnectionButton: {
    backgroundColor: '#2196F3',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  testConnectionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: "#FFF9E6",
    padding: 16,
    borderRadius: 8,
    marginTop: 10,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: "#999",
    marginTop: 8,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    width: "90%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
  },
  pickerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 8,
  },
  pickerContainer: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    textAlign: "center",
    fontWeight: "600",
  },
  buttonGroup: {
    flexDirection: "column",
    gap: 8,
  },
  optionButton: {
    padding: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    alignItems: "center",
  },
  optionButtonActive: {
    backgroundColor: "#007AFF",
  },
  optionText: {
    fontSize: 14,
    color: "#333",
  },
  optionTextActive: {
    color: "white",
    fontWeight: "600",
  },
  scrollPicker: {
    maxHeight: 180,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
  },
  scrollOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    alignItems: "center",
  },
  scrollOptionActive: {
    backgroundColor: "#007AFF",
  },
  scrollOptionText: {
    fontSize: 16,
    color: "#333",
  },
  scrollOptionTextActive: {
    color: "white",
    fontWeight: "600",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelModalButton: {
    backgroundColor: "#E0E0E0",
  },
  confirmButton: {
    backgroundColor: "#007AFF",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});