# Android Agent

Android Foreground Service による位置送信 APK の参照実装プレースホルダーです。

Phase 7 で Capacitor / Kotlin Foreground Service として実装予定。

## 仕様

- 初回 QR で `tracker_token` を保存
- Foreground Service で `watchPosition` 相当の GPS 取得
- `@openmatsuri/tracker-ingest` の `postLocation()` を 3〜5 秒間隔で呼び出し
- オフライン時は Room DB にキュー

## 暫定代替

本番前は `apps/tracker` PWA または SORACOM LTE GPS（`docs/soracom-setup.md`）を使用してください。
