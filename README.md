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

`supabase start` だけでは Edge Functions は**起動しません**。別ターミナルで次を実行してください。

```bash
pnpm functions:dev
# または
supabase functions serve ingest-location ingest-soracom ingest-viewer-location --env-file .env.example
```

起動確認:

```bash
curl http://127.0.0.1:54321/functions/v1/ingest-location -X OPTIONS
# → "ok" が返れば OK
```

| 関数 | 用途 |
|------|------|
| `ingest-location` | Tracker PWA からの位置 |
| `ingest-soracom` | SORACOM からの位置 |
| `ingest-viewer-location` | Viewer からの匿名位置 |

> `pnpm dev` は Next.js アプリ（3000/3001/3002）のみ起動します。Edge Functions は含まれません。

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

## データベース

PostgreSQL + PostGIS（Supabase）のスキーマ・RLS・データフローは [docs/database.md](./docs/database.md) を参照。

主なテーブル:

| グループ | テーブル | 用途 |
|----------|----------|------|
| テナント | `organizations`, `organization_members` | 運営組織・権限 |
| イベント | `events` | 祭り設定・マップ初期表示 |
| トラッカー | `trackers`, `tracker_locations`, `location_history` | 山車などのリアルタイム位置 |
| 来場者 | `viewer_sessions`, `viewer_location_points` | 匿名位置（運営ヒートマップ用） |
| マップ | `pois`, `routes` | 施設・コース |

## SORACOM GPS

[docs/soracom-setup.md](./docs/soracom-setup.md) を参照。

## ロードマップ

| ドキュメント | 内容 |
|-------------|------|
| [docs/roadmap.md](./docs/roadmap.md) | 製品機能（トラッカーアイコン、イベントアイコン、フィードバックなど） |
| [docs/native-roadmap.md](./docs/native-roadmap.md) | ネイティブアプリ（Viewer / Tracker）の Expo 展開 |

## コントリビュート歓迎

OpenMATSURI は OSS です。**Issue・PR・フィードバックを歓迎します。**

気軽に取り組める例:

- バグ報告・再現手順の共有
- ドキュメントや README の改善
- Viewer / Tracker / Admin の UI・UX 改善
- マップ表示・リアルタイム周りの機能追加
- テスト・型・リファクタリング

大きな変更を入れる場合は、先に Issue で方針を相談してもらえると助かります。

## ライセンス

[MIT License](./LICENSE) © 2025 takapi-s
