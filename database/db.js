import * as SQLite from "expo-sqlite";

let db = null;

/**
 * 開啟 SQLite 資料庫
 * 優先使用 openDatabaseAsync (expo-sqlite v13+)
 */
export async function getDB() {
  if (db) return db;

  try {
    // expo-sqlite v13+ 使用 openDatabaseAsync
    if (typeof SQLite.openDatabaseAsync === "function") {
      db = await SQLite.openDatabaseAsync("diary.db");
      console.log("✅ Database opened with openDatabaseAsync");
      return db;
    }

    // 備用: openDatabaseSync
    if (typeof SQLite.openDatabaseSync === "function") {
      db = SQLite.openDatabaseSync("diary.db");
      console.log("✅ Database opened with openDatabaseSync");
      return db;
    }

    // 舊版 API (expo-sqlite v12 以前)
    if (typeof SQLite.openDatabase === "function") {
      db = SQLite.openDatabase("diary.db");
      console.log("✅ Database opened with openDatabase (legacy)");
      return db;
    }

    console.warn(
      "expo-sqlite native module is not available. Database operations will be disabled."
    );
    return null;
  } catch (e) {
    console.error("Error opening database:", e);
    return null;
  }
}

/**
 * 執行 SQL 語句
 * 支援新舊兩種 API
 */
async function executeSqlAsync(dbInstance, sql, params = []) {
  if (!dbInstance) {
    throw new Error("No database available (expo-sqlite native module missing).");
  }

  try {
    // 新版 API: 直接使用 execAsync 或 runAsync
    if (typeof dbInstance.execAsync === "function") {
      // execAsync 用於 CREATE TABLE 等不需要返回值的操作
      if (sql.trim().toUpperCase().startsWith("CREATE") || 
          sql.trim().toUpperCase().startsWith("ALTER")) {
        await dbInstance.execAsync(sql);
        return { rows: { _array: [] } };
      }
      // 其他操作使用 runAsync
      const result = await dbInstance.runAsync(sql, params);
      return result;
    }

    // 另一種新版 API: getAllAsync, runAsync, getFirstAsync
    if (typeof dbInstance.runAsync === "function") {
      const result = await dbInstance.runAsync(sql, params);
      return result;
    }

    // 舊版 API: transaction
    if (typeof dbInstance.transaction === "function") {
      return new Promise((resolve, reject) => {
        dbInstance.transaction(
          (tx) => {
            tx.executeSql(
              sql,
              params,
              (_, result) => resolve(result),
              (_, err) => {
                reject(err);
                return false;
              }
            );
          },
          (txError) => reject(txError)
        );
      });
    }

    throw new Error("Database instance has no supported execution method");
  } catch (e) {
    console.error("SQL execution error:", e);
    throw e;
  }
}

export async function initDatabase() {
  try {
    const dbInstance = await getDB();

    if (!dbInstance) {
      console.warn(
        "Skipping database initialization because expo-sqlite is not available."
      );
      return;
    }

    // 建立主表格
    const createTableSQL = `CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      sentiment INTEGER,
      lat REAL,
      lng REAL,
      vlog_uri TEXT,
      synced INTEGER DEFAULT 0,
      sync_attempts INTEGER DEFAULT 0,
      last_sync_attempt TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`;

    await executeSqlAsync(dbInstance, createTableSQL);
    console.log("✅ daily_logs table ready");

    // 檢查並更新現有表格（如果舊版本沒有 synced 欄位）
    try {
      // 嘗試讀取一筆資料來檢查欄位
      if (typeof dbInstance.getAllAsync === "function") {
        const testRow = await dbInstance.getAllAsync("SELECT * FROM daily_logs LIMIT 1");
        if (testRow.length > 0 && !('synced' in testRow[0])) {
          // 舊表格，需要更新
          console.log("⚠️ Updating table schema...");
          await executeSqlAsync(dbInstance, "ALTER TABLE daily_logs ADD COLUMN synced INTEGER DEFAULT 0");
          await executeSqlAsync(dbInstance, "ALTER TABLE daily_logs ADD COLUMN sync_attempts INTEGER DEFAULT 0");
          await executeSqlAsync(dbInstance, "ALTER TABLE daily_logs ADD COLUMN last_sync_attempt TEXT");
          await executeSqlAsync(dbInstance, "ALTER TABLE daily_logs ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP");
          console.log("✅ Table schema updated");
        }
      }
    } catch (alterError) {
      // 如果已經有這些欄位會報錯，但沒關係
      console.log("Table schema is up to date");
    }

  } catch (error) {
    console.error("❌ Error creating daily_logs table", error);
    throw error;
  }
}

/**
 * 執行查詢並返回結果
 */
export async function runQuery(sql, params = []) {
  const dbInstance = await getDB();
  if (!dbInstance) throw new Error("No database available");

  try {
    // 新版 API: 根據查詢類型選擇方法
    if (typeof dbInstance.getAllAsync === "function") {
      // SELECT 查詢
      if (sql.trim().toUpperCase().startsWith("SELECT")) {
        const rows = await dbInstance.getAllAsync(sql, params);
        return { rows: { _array: rows } };
      }
      // INSERT, UPDATE, DELETE
      const result = await dbInstance.runAsync(sql, params);
      return result;
    }

    // 舊版 API
    return await executeSqlAsync(dbInstance, sql, params);
  } catch (e) {
    console.error("Query execution error:", e);
    throw e;
  }
}

/**
 * 插入一筆 daily_log 資料
 */
export async function insertDailyLog(data) {
  try {
    const dbInstance = await getDB();
    if (!dbInstance) {
      throw new Error("Database not available");
    }

    const { timestamp, sentiment, lat, lng, vlog_uri } = data;
    const sql = `INSERT INTO daily_logs (timestamp, sentiment, lat, lng, vlog_uri, synced, created_at) 
                 VALUES (?, ?, ?, ?, ?, 0, ?)`;
    
    const now = new Date().toISOString();
    
    // 使用新版 API
    if (typeof dbInstance.runAsync === "function") {
      const result = await dbInstance.runAsync(sql, [timestamp, sentiment, lat, lng, vlog_uri, now]);
      console.log("✅ Data inserted successfully, ID:", result.lastInsertRowId);
      return result;
    }
    
    // 舊版 API fallback
    return await runQuery(sql, [timestamp, sentiment, lat, lng, vlog_uri, now]);
  } catch (error) {
    console.error("❌ Error inserting daily log:", error);
    throw error;
  }
}

/**
 * 取得所有 daily_logs
 */
export async function getAllDailyLogs() {
  try {
    const dbInstance = await getDB();
    if (!dbInstance) {
      console.warn("Database not available, returning empty array");
      return [];
    }

    if (typeof dbInstance.getAllAsync === "function") {
      const rows = await dbInstance.getAllAsync("SELECT * FROM daily_logs ORDER BY timestamp DESC");
      return rows;
    }

    // 舊版 API
    const result = await runQuery("SELECT * FROM daily_logs ORDER BY timestamp DESC");
    return result.rows._array;
  } catch (error) {
    console.error("❌ Error getting all daily logs:", error);
    return [];
  }
}

/**
 * 標記記錄為已同步
 */
export async function markAsSynced(id) {
  try {
    const dbInstance = await getDB();
    if (!dbInstance) return;

    const sql = `UPDATE daily_logs SET synced = 1, last_sync_attempt = ? WHERE id = ?`;
    const now = new Date().toISOString();
    
    if (typeof dbInstance.runAsync === "function") {
      await dbInstance.runAsync(sql, [now, id]);
    } else {
      await runQuery(sql, [now, id]);
    }
    
    console.log(`✅ Record ${id} marked as synced`);
  } catch (error) {
    console.error("❌ Error marking as synced:", error);
  }
}

/**
 * 記錄同步失敗
 */
export async function recordSyncFailure(id) {
  try {
    const dbInstance = await getDB();
    if (!dbInstance) return;

    const sql = `UPDATE daily_logs 
                 SET sync_attempts = sync_attempts + 1, 
                     last_sync_attempt = ? 
                 WHERE id = ?`;
    const now = new Date().toISOString();
    
    if (typeof dbInstance.runAsync === "function") {
      await dbInstance.runAsync(sql, [now, id]);
    } else {
      await runQuery(sql, [now, id]);
    }
    
    console.log(`⚠️ Sync failure recorded for record ${id}`);
  } catch (error) {
    console.error("❌ Error recording sync failure:", error);
  }
}

/**
 * 取得未同步的記錄
 */
export async function getUnsyncedLogs() {
  try {
    const dbInstance = await getDB();
    if (!dbInstance) return [];

    const sql = "SELECT * FROM daily_logs WHERE synced = 0 ORDER BY timestamp ASC";
    
    if (typeof dbInstance.getAllAsync === "function") {
      return await dbInstance.getAllAsync(sql);
    }

    const result = await runQuery(sql);
    return result.rows._array;
  } catch (error) {
    console.error("❌ Error getting unsynced logs:", error);
    return [];
  }
}

/**
 * 取得同步統計
 */
export async function getSyncStats() {
  try {
    const dbInstance = await getDB();
    if (!dbInstance) return { total: 0, synced: 0, unsynced: 0 };

    if (typeof dbInstance.getAllAsync === "function") {
      const [totalResult] = await dbInstance.getAllAsync("SELECT COUNT(*) as count FROM daily_logs");
      const [syncedResult] = await dbInstance.getAllAsync("SELECT COUNT(*) as count FROM daily_logs WHERE synced = 1");
      
      return {
        total: totalResult.count,
        synced: syncedResult.count,
        unsynced: totalResult.count - syncedResult.count
      };
    }

    const totalResult = await runQuery("SELECT COUNT(*) as count FROM daily_logs");
    const syncedResult = await runQuery("SELECT COUNT(*) as count FROM daily_logs WHERE synced = 1");
    
    return {
      total: totalResult.rows._array[0].count,
      synced: syncedResult.rows._array[0].count,
      unsynced: totalResult.rows._array[0].count - syncedResult.rows._array[0].count
    };
  } catch (error) {
    console.error("❌ Error getting sync stats:", error);
    return { total: 0, synced: 0, unsynced: 0 };
  }
}
