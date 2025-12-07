import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";  // ← 加入 useFocusEffect
import { useCallback } from "react";  // ← 加入 useCallback

export default function HomeScreen() {
  const router = useRouter();
  const [selectedSentiment, setSelectedSentiment] = useState(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

    // 🆕 每次進入此頁面時重置狀態
  useFocusEffect(
    useCallback(() => {
      // 清空選擇和備註
      setSelectedSentiment(null);
      setNote("");
    }, [])
  );

  useEffect(() => {
    // 可以在這裡做其他初始化
  }, []);

  // 前往拍攝 vlog（會帶著 sentiment 和 note 資料）
  const handleGoToCamera = () => {
    if (selectedSentiment === null) {
      Alert.alert("請選擇情緒", "請先選擇您今天的心情分數");
      return;
    }
    // 將 sentiment 和 note 傳到 camera 頁面
    router.push({
      pathname: "/(tabs)/camera",
      params: { 
        sentiment: selectedSentiment,
        note: note || "" // 如果沒輸入就傳空字串
      }
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
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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

        {/* 🆕 備註輸入框 */}
        <View style={styles.noteSection}>
          <Text style={styles.noteTitle}>📝 想說些什麼嗎？（選填）</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="例如：今天天氣很好、完成了重要的工作..."
            placeholderTextColor="#999"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            maxLength={200}
          />
          <Text style={styles.noteHint}>
            💡 可以記錄當下的心情或想法，也可以不填
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.cameraButton]}
          onPress={handleGoToCamera}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonText}>📹 下一步：錄製 1 秒 Vlog</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          💡 提示：選擇心情後，點擊按鈕錄製 1 秒 vlog
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 30,
    color: "#333",
  },
  sentimentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 15,
    marginBottom: 30,
  },
  sentimentButton: {
    width: 90,
    padding: 15,
    backgroundColor: "white",
    borderRadius: 15,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ddd",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedButton: {
    borderColor: "#4CAF50",
    backgroundColor: "#e8f5e9",
    transform: [{ scale: 1.05 }],
  },
  emoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  sentimentValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4CAF50",
    marginBottom: 4,
  },
  sentimentLabel: {
    fontSize: 12,
    color: "#666",
  },
  // 🆕 備註區樣式
  noteSection: {
    backgroundColor: "white",
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  noteInput: {
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 15,
    fontSize: 15,
    color: "#333",
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  noteHint: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
    fontStyle: "italic",
  },
  button: {
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 10,
  },
  cameraButton: {
    backgroundColor: "#FF5722",
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  hint: {
    textAlign: "center",
    color: "#666",
    fontSize: 14,
    marginTop: 15,
    fontStyle: "italic",
  },
});