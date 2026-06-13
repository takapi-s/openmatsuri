# OpenMATSURI

**Open-source live map framework for festivals.**

祭りの移動体（山車・だんじり・神輿など）をリアルタイムでマップ表示する OSS フレームワーク。

## アーキテクチャ

| アプリ | ポート | 用途 |
|--------|--------|------|
| `apps/viewer` | 3000 | 来場者向けマップ |
| `apps/tracker` | 3001 | 位置発信 PWA |
| `apps/admin` | 3002 | 運営ダッシュボード |

## クイックスタート

### 前提

- Node.js 20+
- pnpm 9+
- Docker（Supabase ローカル用）
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)

### 1. 依存関係

```bash
cd ~/takapi-s/openmatsuri
pnpm install
cp .env.example apps/viewer/.env.local
cp .env.example apps/tracker/.env.local
cp .env.example apps/admin/.env.local
```

### 2. Supabase 起動 + DB

```bash
supabase start
supabase db reset
```

### 3. Edge Functions

```bash
supabase functions serve ingest-location ingest-soracom --env-file .env.example
```

### 4. アプリ起動

```bash
pnpm dev
```

- Viewer: http://localhost:3000/e/demo-matsuri
- Tracker: http://localhost:3001/t/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
- Admin: http://localhost:3002

### 5. Admin 初回セットアップ

1. Admin でアカウント登録
2. 「デモ実行委員会に参加」をクリック
3. トラッカー QR を発行 → スマホで Tracker 起動
4. Viewer でリアルタイム表示を確認

## Docker Compose

```bash
docker compose up -d
```

> Supabase フルスタックは `supabase start` を推奨。`docker-compose.yml` は DB + アプリの構成例です。

## 地図タイル

デフォルトは [OpenFreeMap](https://openfreemap.org/)。OSM 公式タイルサーバーは本番利用禁止です。

環境変数 `NEXT_PUBLIC_MAP_STYLE_URL` で変更可能。

## SORACOM GPS

[docs/soracom-setup.md](./docs/soracom-setup.md) を参照。

## ライセンス

MIT
