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
      if (sql.trim().toUpperCase().startsWith("CREATE")) {
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

    const createTableSQL = `CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      sentiment INTEGER,
      lat REAL,
      lng REAL,
      vlog_uri TEXT
    );`;

    await executeSqlAsync(dbInstance, createTableSQL);

    console.log("✅ daily_logs table ready");
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
    const sql = `INSERT INTO daily_logs (timestamp, sentiment, lat, lng, vlog_uri) 
                 VALUES (?, ?, ?, ?, ?)`;
    
    // 使用新版 API
    if (typeof dbInstance.runAsync === "function") {
      const result = await dbInstance.runAsync(sql, [timestamp, sentiment, lat, lng, vlog_uri]);
      console.log("✅ Data inserted successfully, ID:", result.lastInsertRowId);
      return result;
    }
    
    // 舊版 API fallback
    return await runQuery(sql, [timestamp, sentiment, lat, lng, vlog_uri]);
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