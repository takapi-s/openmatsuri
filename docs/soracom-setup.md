# SORACOM GPS 連携セットアップ

GPS マルチユニット SORACOM Edition などの LTE GPS デバイスを OpenMATSURI に接続する手順です。

## 概要

```
GPSデバイス → SORACOM Unified Endpoint → Beam → ingest-soracom → Viewer
```

デバイスにカスタムソフトはインストールできません。SORACOM コンソールで Beam 転送先を設定します。

## 1. Admin でトラッカー登録

1. Admin (`http://localhost:3002`) にログイン
2. トラッカーを追加し、`device_type` を **SORACOM LTE GPS** に設定
3. `soracom_sim_id` に IoT SIM ID を入力
4. 表示される Beam 転送先 URL をメモ:
   ```
   https://<your-supabase>/functions/v1/ingest-soracom
   ```

## 2. SORACOM コンソール設定

1. [SORACOM ユーザーコンソール](https://console.soracom.io/) にログイン
2. GPS マルチユニットの SIM を SIM グループに追加
3. **Harvest Data** を有効化（疎通確認用）
4. **SORACOM Beam** を有効化:
   - エントリポイント: UDP → HTTP/HTTPS
   - 転送先: `ingest-soracom` の URL
   - **SIM ID ヘッダ**: オン
   - 署名ヘッダ: `x-soracom-signature` = 環境変数 `SORACOM_BEAM_SECRET` と同じ値

## 3. Base64 デコード（必要な場合）

Beam 経由でペイロードが Base64 になる場合、[SORACOM Orbit](https://users.soracom.io/ja-jp/docs/orbit/) の Soralet でデコードしてから転送してください。

参考: [GPS マルチユニット → Beam 公式ガイド](https://users.soracom.io/ja-jp/guides/iot-devices/gps-multiunit/send-location-beam/)

## 4. ペイロード形式（デコード後）

```json
{
  "lat": 34.6937,
  "lon": 135.5023,
  "battery": 85,
  "timestamp": 1718180000
}
```

## 5. セキュリティ

- `SORACOM_BEAM_SECRET` は必ず本番用のランダム値に変更
- SIM ID ヘッダだけではなりすまし可能なため、署名検証を必須としています

## 6. 疎通確認

1. Harvest Data で位置データが届くことを確認
2. Beam 転送先の Edge Function ログを確認
3. Viewer (`/e/<slug>`) でマーカーが更新されることを確認
