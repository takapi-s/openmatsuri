# Pi Agent

Raspberry Pi + USB GPS (gpsd) から位置情報を送信する参照実装です。

## セットアップ

```bash
sudo apt install gpsd gpsd-clients
export TRACKER_TOKEN=<admin で発行した token>
export SUPABASE_ANON_KEY=<anon key>
export INGEST_ENDPOINT=http://127.0.0.1:54321/functions/v1/ingest-location
python3 agent.py
```

systemd unit の例は `festival-tracker.service` を参照してください。
