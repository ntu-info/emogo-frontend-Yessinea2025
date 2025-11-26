import { useEffect } from "react";
import { Stack } from "expo-router";
import { initDatabase } from "../database/db";
import * as SQLite from "expo-sqlite";
import Constants from "expo-constants";

// Diagnostic logs to help verify whether the running client includes native modules
console.log("[diag] appOwnership:", Constants.appOwnership);
console.log("[diag] nativeAppVersion:", Constants.nativeAppVersion || Constants.manifest?.version);
console.log("[diag] SQLite.openDatabase type:", typeof SQLite.openDatabase);
try {
  console.log("[diag] SQLite keys:", Object.keys(SQLite));
} catch (e) {
  console.log("[diag] SQLite keys: error", e.message);
}

export default function RootLayout() {
  useEffect(() => {
    // initDatabase is async; run it and handle errors
    (async () => {
      try {
        await initDatabase();
      } catch (err) {
        // Prevent app crash on DB init failure; log for debugging
        console.error("Database initialization failed:", err);
      }
    })();
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="details" options={{ title: "Details" }} />
    </Stack>
  );
}
