import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();
  const [selectedSentiment, setSelectedSentiment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // 可以在這裡做其他初始化
  }, []);

  // 前往拍攝 vlog（會帶著 sentiment 資料）
  const handleGoToCamera = () => {
    if (selectedSentiment === null) {
      Alert.alert("請選擇情緒", "請先選擇您今天的心情分數");
      return;
    }
    // 將 sentiment 傳到 camera 頁面
    router.push({
      pathname: "/(tabs)/camera",
      params: { sentiment: selectedSentiment }
    });
  };

  const sentiments = [
    { value: 1, emoji: "😢", label: "很差" },
    { value: 2, emoji: "😔", label: "不太好" },
    { value: 3, emoji: "😐", label: "普通" },
    { value: 4, emoji: "😊", label: "好" },
    { value: 5, emoji: "😄", label: "很好" },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>今天心情如何？</Text>

      <View style={styles.sentimentGrid}>
        {sentiments.map((item) => (
          <TouchableOpacity
            key={item.value}
            style={[
              styles.sentimentButton,
              selectedSentiment === item.value && styles.selectedButton,
            ]}
            onPress={() => setSelectedSentiment(item.value)}
          >
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.sentimentValue}>{item.value}</Text>
            <Text style={styles.sentimentLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, styles.cameraButton]}
        onPress={handleGoToCamera}
        disabled={isSubmitting}
      >
        <Text style={styles.buttonText}> 下一步：📹 錄製 1 秒 Vlog</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        💡 提示：選擇心情後，點擊按鈕錄製 1 秒 vlog
      </Text>
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
    textAlign: "center",
    marginBottom: 30,
    color: "#333",
  },
  sentimentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  sentimentButton: {
    width: "18%",
    aspectRatio: 1,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 8,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ddd",
  },
  selectedButton: {
    borderColor: "#007AFF",
    backgroundColor: "#E3F2FD",
  },
  emoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  sentimentValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  sentimentLabel: {
    fontSize: 11,
    color: "#666",
    textAlign: "center",
  },
  actionButtons: {
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  cameraButton: {
    backgroundColor: "#FF3B30",
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  hint: {
    textAlign: "center",
    color: "#666",
    fontSize: 14,
    marginTop: 20,
  },
});