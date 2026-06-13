# ネイティブアプリ ロードマップ（Viewer / Tracker）

OpenMATSURI のネイティブアプリ展開計画。対象は **Viewer（来場者マップ）** と **Tracker（位置発信）** の2つ。Admin は Web のまま運用する。

## 方針

- **React Native / Expo を主軸**とする。
  - バックエンド（Supabase DB / Realtime / Edge Functions）は**無改修**で利用可能。
  - `supabase-js` がそのまま動くため、Realtime 購読・RLS 認証・Edge Functions 呼び出しを新規実装せずに持ち込める。
  - TypeScript + Supabase の知識で OSS コントリビュートできる（参加障壁が低い）。
- **既存パッケージを最大限再利用**する。
  - `packages/config`（zod スキーマ・enum・ラベル・EWKT 変換）
  - `packages/realtime/src/geo.ts`（EWKB/WKT パーサ、純粋関数）
  - `packages/realtime` のオンライン判定ロジック（`isTrackerOnline` / `countOnlineTrackers` / `filterOnlineLocations`）
- **作り直すのは UI と地図のみ。**
  - `maplibre-gl-js` → `@maplibre/maplibre-react-native`
  - 地図スタイル URL（OpenFreeMap）はそのまま利用。

## 想定構成

```
apps/
  viewer-native/    Expo（来場者マップ）
  tracker-native/   Expo（位置発信・バックグラウンドGPS）
packages/
  config/           ← 再利用（無改修）
  realtime/         ← 純粋ロジックを再利用（要リファクタ）
  core/ (新設候補)  ← React非依存の純粋ロジック集約先
```

---

## Phase 0: 共有ロジックの非Web化（基盤整備）

ネイティブ実装の前に、共有パッケージから Web 依存を剥がす。

- [ ] `packages/realtime/src/hooks.ts` の **純粋関数を別エントリに分離**する。
  - 対象: `isTrackerOnline` / `isTrackerStale` / `getTrackerLastSeenAt` / `filterOnlineLocations` / `countOnlineTrackers` / 各種定数
  - 現状はファイル先頭に `"use client"` があり React を import するため、ネイティブから使うと React を巻き込む。
- [ ] `window.setInterval` / `window.clearInterval` → `setInterval` / `clearInterval` に置換（ブラウザ / RN / Node すべてで動作）。
- [ ] `getRealtimeMode()` の `process.env.NEXT_PUBLIC_*` 参照を、env を引数で受け取る形に一般化（Expo は `EXPO_PUBLIC_*`）。
- [ ] `packages/config`・`geo.ts` は無改修で再利用できることを確認（純粋 TS）。

## Phase 1: Viewer ネイティブ（来場者マップ）

技術検証を兼ねて、より単純な Viewer から着手する。

- [ ] Expo プロジェクト作成（`apps/viewer-native`）。monorepo（pnpm + turbo）に組み込み。
- [ ] `supabase-js` クライアントを Expo 環境で初期化（`EXPO_PUBLIC_SUPABASE_URL` / `ANON_KEY`）。
- [ ] `@maplibre/maplibre-react-native` で地図表示（OpenFreeMap スタイル）。
- [ ] Realtime のトラッカー位置購読を実装（`postgres_changes` モード）。
  - 既存の `useTrackerLocations` 相当のロジックを RN 向けに再実装（購読 + ポーリングのハイブリッド）。
- [ ] POI / ルート表示、トラッカーマーカー描画。
- [ ] オンライン/オフライン判定は Phase 0 で切り出した純粋関数を再利用。
- [ ] ディープリンク対応（`/e/:slug` 相当でイベントを開く）。

## Phase 2: Tracker ネイティブ（位置発信）★最重要

最もネイティブ性能が問われる部分。**バックグラウンド GPS の安定性**が肝。

- [ ] Expo プロジェクト作成（`apps/tracker-native`）。
- [ ] トークン URL（`/t/:token`）からの起動・ディープリンク対応。
- [ ] `expo-location` + `expo-task-manager` で**バックグラウンド位置取得**を実装。
  - iOS の背景実行制限・省電力・長時間稼働の安定性を必ず実機検証する。
- [ ] `ingest-location` Edge Function への送信は `packages/tracker-ingest` の `postLocation`（`fetch` + zod）を再利用。
- [ ] **オフラインキュー**を実装（既存 `apps/tracker/src/lib/offline-queue.ts` を参考に、ストレージを `AsyncStorage` 等へ移植）。
- [ ] 電池残量・送信間隔・送信状態の表示。
- [ ] 山車搭載を想定した長時間・画面オフ運用の実機テスト。

> Expo の `expo-location` で背景送信の安定性が不足する場合は、config plugin / 自作ネイティブモジュールで補強する。要件がシビアなら Tracker のみフルネイティブ（Swift/Kotlin）化も選択肢。

## Phase 3: 配布・運用

- [ ] EAS Build / EAS Submit で iOS・Android のビルド配布パイプライン整備。
- [ ] アプリ内 OTA アップデート（`expo-updates`）の検討。
- [ ] ストア掲載（App Store / Google Play）またはイベント向け内部配布。
- [ ] OSS としてのセットアップ手順を本ドキュメントに追記。

---

## 判断ポイント

- ネイティブ化の主目的が **配布（ストア）** なら Expo で十分。
- 主目的が **Tracker のバックグラウンド GPS 安定性** で要件がシビアなら、Tracker のみフルネイティブを検討する。

## 再利用可否まとめ

| 層 | 再利用 | 備考 |
|----|--------|------|
| Supabase DB / Realtime / Edge Functions | そのまま | バックエンド無改修 |
| `packages/config` | そのまま | 純粋 TS |
| `packages/realtime/geo.ts` | そのまま | 純粋 TS |
| オンライン判定ロジック | 要リファクタ | React/`window` 依存を分離（Phase 0） |
| `packages/tracker-ingest` | ほぼそのまま | `fetch` + zod |
| `packages/ui` / `packages/map` | 作り直し | Web（React + maplibre-gl-js）専用 |
