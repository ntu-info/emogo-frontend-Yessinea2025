import { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as Location from "expo-location";
import { useRouter, useLocalSearchParams } from "expo-router";
import { insertDailyLog, markAsSynced, recordSyncFailure } from "../../database/db";
import { uploadDailyLog } from "../../api/backend";

export default function CameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const sentiment = params.sentiment ? parseInt(params.sentiment) : null;
  const note = params.note || ""; // 🆕 接收 note

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [facing, setFacing] = useState("front");
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const cameraRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    (async () => {
      if (!cameraPermission?.granted) await requestCameraPermission();
      if (!microphonePermission?.granted) await requestMicrophonePermission();
      if (!mediaPermission?.granted) await requestMediaPermission();
    })();
  }, []);

  // 清理計時器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  if (!cameraPermission || !microphonePermission || !mediaPermission) return <View />;

  if (!cameraPermission.granted || !microphonePermission.granted || !mediaPermission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>需要相機、麥克風和媒體庫權限</Text>
        <TouchableOpacity
          onPress={() => {
            requestCameraPermission();
            requestMicrophonePermission();
            requestMediaPermission();
          }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>允許所有權限</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        return { lat: null, lng: null };
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
    } catch (err) {
      console.error("Error getting location:", err);
      return { lat: null, lng: null };
    }
  };

  const recordOneSecondVlog = async () => {
    let insertedId = null;
    
    try {
      if (!cameraRef.current || isRecording) return;

      setIsRecording(true);
      setRecordingTime(0);

      // 開始計時器（每 100ms 更新一次）
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 0.1);
      }, 100);

      // 開始錄影
      const video = await cameraRef.current.recordAsync({
        maxDuration: 1,
        quality: "720p",
      });

      // 停止計時器
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setIsRecording(false);

      // 儲存到相簿
      const asset = await MediaLibrary.createAssetAsync(video.uri);
      
      // 取得位置
      const location = await getCurrentLocation();

      // === 1. 先儲存到本地資料庫 ===
      const logData = {
        timestamp: new Date().toISOString(),
        sentiment: sentiment,
        lat: location.lat,
        lng: location.lng,
        vlog_uri: asset.uri,
      };

      const result = await insertDailyLog(logData);
      insertedId = result.lastInsertRowId;
      
      console.log(`✅ 本地儲存成功，ID: ${insertedId}`);

      // === 2. 嘗試上傳到雲端 ===
      setIsUploading(true);
      
      const uploadResult = await uploadDailyLog(
        sentiment,
        location.lat,
        location.lng,
        asset.uri,
        note // 🆕 傳遞 note 到後端
      );

      setIsUploading(false);

      if (uploadResult.success) {
        // 上傳成功 - 標記為已同步
        await markAsSynced(insertedId);
        
        Alert.alert(
          "✅ 成功！",
          "1秒 vlog 已儲存\n\n✓ 本地儲存\n✓ 雲端同步",
          [
            {
              text: "返回首頁",
              onPress: () => router.push("/(tabs)"),
            },
          ]
        );
      } else {
        // 上傳失敗 - 記錄失敗次數
        await recordSyncFailure(insertedId);
        
        // 顯示警告但不阻擋使用者
        Alert.alert(
          "⚠️ 部分成功",
          `1秒 vlog 已儲存到本地！\n\n✓ 本地儲存成功\n✗ 雲端同步失敗\n\n原因：${uploadResult.errors.join(', ')}\n\n稍後可在設定中重新同步`,
          [
            {
              text: "返回首頁",
              onPress: () => router.push("/(tabs)"),
            },
          ]
        );
      }
      
    } catch (err) {
      console.error("Recording error:", err);
      
      // 清理計時器
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      setIsRecording(false);
      setIsUploading(false);
      setRecordingTime(0);
      
      // 如果有 insertedId，記錄同步失敗
      if (insertedId) {
        await recordSyncFailure(insertedId);
      }
      
      Alert.alert("錯誤", "錄製失敗，請稍後再試");
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
    }
  };

  const toggleCamera = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  // 格式化時間為 00:00
  const formatTime = (seconds) => {
    const secs = Math.floor(seconds);
    const decisecs = Math.floor((seconds - secs) * 10);
    return `00:0${secs}`;
  };

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode="video"
      />

      {/* 所有 UI 元素都在 CameraView 外面，使用絕對定位 */}
      
      {/* 錄影時間顯示 */}
      {isRecording && (
        <View style={styles.timerBadge}>
          <Text style={styles.timerText}>{formatTime(recordingTime)}</Text>
        </View>
      )}

      {/* 上傳進度顯示 */}
      {isUploading && (
        <View style={styles.uploadingOverlay}>
          <View style={styles.uploadingBox}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.uploadingText}>正在同步到雲端...</Text>
          </View>
        </View>
      )}

      {/* 錄製按鈕 */}
      <TouchableOpacity
        onPress={isRecording ? stopRecording : recordOneSecondVlog}
        style={[
          styles.recordButton,
          isRecording && styles.recordingButton,
        ]}
        disabled={isRecording || isUploading}
      >
        {isRecording ? (
          <View style={styles.innerStop} />
        ) : (
          <View style={styles.innerDot} />
        )}
      </TouchableOpacity>

      {/* 切換鏡頭按鈕 */}
      {!isRecording && !isUploading && (
        <TouchableOpacity onPress={toggleCamera} style={styles.switchButton}>
          <Text style={styles.buttonText}>🔄</Text>
        </TouchableOpacity>
      )}

      {/* 返回按鈕 */}
      {!isRecording && !isUploading && (
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.buttonText}>← 返回</Text>
        </TouchableOpacity>
      )}

      {/* 說明文字 */}
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          💡 點擊紅色按鈕錄製 1 秒 vlog
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  camera: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  timerBadge: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: "rgba(255, 0, 0, 0.8)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  timerText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadingBox: {
    backgroundColor: "white",
    padding: 30,
    borderRadius: 15,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  uploadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
  recordButton: {
    position: "absolute",
    bottom: 50,
    alignSelf: "center",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 5,
    borderColor: "#FF0000",
  },
  recordingButton: {
    borderColor: "#FF0000",
    backgroundColor: "#FF0000",
  },
  innerDot: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FF0000",
  },
  innerStop: {
    width: 40,
    height: 40,
    backgroundColor: "white",
  },
  switchButton: {
    position: "absolute",
    bottom: 60,
    right: 30,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
  },
  instructions: {
    position: "absolute",
    bottom: 150,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  instructionText: {
    color: "white",
    fontSize: 14,
  },
});