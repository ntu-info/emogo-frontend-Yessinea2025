import { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as Location from "expo-location";
import { useRouter, useLocalSearchParams } from "expo-router";
import { insertDailyLog } from "../../database/db";

export default function CameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const sentiment = params.sentiment ? parseInt(params.sentiment) : null;

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [facing, setFacing] = useState("front");
  const [isRecording, setIsRecording] = useState(false);
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

      // 儲存到資料庫
      await insertDailyLog({
        timestamp: new Date().toISOString(),
        sentiment: sentiment,
        lat: location.lat,
        lng: location.lng,
        vlog_uri: asset.uri,
      });

      Alert.alert(
        "✅ 錄製成功",
        "1秒 vlog 已儲存到相簿並記錄到資料庫！",
        [
          {
            text: "返回首頁",
            onPress: () => router.push("/(tabs)"),
          },
        ]
      );
    } catch (err) {
      console.error("Recording error:", err);
      
      // 清理計時器
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      setIsRecording(false);
      setRecordingTime(0);
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

      {/* 錄製按鈕 */}
      <TouchableOpacity
        onPress={isRecording ? stopRecording : recordOneSecondVlog}
        style={[
          styles.recordButton,
          isRecording && styles.recordingButton,
        ]}
        disabled={isRecording}
      >
        {isRecording ? (
          <View style={styles.innerStop} />
        ) : (
          <View style={styles.innerDot} />
        )}
      </TouchableOpacity>

      {/* 切換鏡頭按鈕 */}
      {!isRecording && (
        <TouchableOpacity onPress={toggleCamera} style={styles.switchButton}>
          <Text style={styles.buttonText}>🔄</Text>
        </TouchableOpacity>
      )}

      {/* 返回按鈕 */}
      {!isRecording && (
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
          💡 點擊紅色按鈕開始錄製，將自動錄製 1 秒 vlog
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "black" 
  },
  camera: { 
    flex: 1 
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  permissionText: {
    color: "white",
    fontSize: 18,
    marginBottom: 20,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  timerBadge: {
    position: "absolute",
    top: 80,
    alignSelf: "center",
    backgroundColor: "rgba(255, 59, 48, 0.9)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    zIndex: 10,
  },
  timerText: {
    color: "white",
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  recordButton: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "white",
    zIndex: 10,
  },
  recordingButton: {
    backgroundColor: "transparent",
    opacity: 0.8,
  },
  innerDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ff3b30",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.9)",
  },
  innerStop: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: "#ffffff",
  },
  switchButton: {
    position: "absolute",
    top: 60,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 12,
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 10,
  },
  instructions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 15,
    zIndex: 10,
  },
  instructionText: {
    color: "white",
    textAlign: "center",
    fontSize: 14,
  },
});