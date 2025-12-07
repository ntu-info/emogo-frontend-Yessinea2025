[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/1M59WghA)
[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg)](https://classroom.github.com/online_ide?assignment_repo_id=21775125&assignment_repo_type=AssignmentRepo)
# Expo Router Minimal Working Example

This is a very small Expo project using **expo-router** with:

- A root `Stack` layout
- A `(tabs)` group using `Tabs`
- A `details` screen pushed on top of the tab stack
- `Link` components and `useRouter` for navigation

## How to run

1. Install dependencies:

   ```bash
   npm install
   # or
   yarn
   ```

2. Start the dev server:

   ```bash
   npx expo start --tunnel
   ```

3. Open the app on a device or emulator using the Expo dev tools.

4. Send and open the URL below to install it on a device.  
   (updated) https://expo.dev/accounts/yessinea/projects/expo-router-mwe/builds/2aedaf10-163f-483d-baa6-8b25115f69ed

### 使用說明

1. **選擇心情** - 點擊 1-5 顆心評分（1 = 很難過，5 = 很開心）
2. **輸入備註**（可選）- 記錄當下的想法
3. **點擊「下一步」**
4. **錄製影片** - 自動錄影 1 秒並上傳
5. **查看資料** - 訪問 https://emogo-backend-yessinea2025.onrender.com/export

### ⚠️ App 使用注意事項

**首次連接較慢：** Render Free Plan 可能需要 30-60 秒喚醒

**建議測試流程：**
1. 先在瀏覽器訪問 `/export` 頁面（喚醒伺服器）
2. 等待頁面完全載入（約 30-60 秒）
3. 立即使用 App 上傳資料
4. 上傳應該會成功