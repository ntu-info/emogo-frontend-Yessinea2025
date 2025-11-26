import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#8E8E93",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "記錄情緒",
          tabBarIcon: ({ color }) => <TabBarIcon name="📝" color={color} />,
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: "1秒Vlog",
          tabBarIcon: ({ color }) => <TabBarIcon name="📹" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "設定",
          tabBarIcon: ({ color }) => <TabBarIcon name="⚙️" color={color} />,
        }}
      />
    </Tabs>
  );
}

// 簡單的 emoji 圖示元件
function TabBarIcon({ name, color }) {
  return (
    <Text style={{ fontSize: 24, color }}>
      {name}
    </Text>
  );
}

// 需要 import Text
import { Text } from "react-native";