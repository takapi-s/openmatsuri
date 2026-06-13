FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/viewer/package.json ./apps/viewer/
COPY packages/config/package.json ./packages/config/
COPY packages/map/package.json ./packages/map/
COPY packages/realtime/package.json ./packages/realtime/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @openmatsuri/viewer build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/apps/viewer/.next/standalone ./
COPY --from=builder /app/apps/viewer/.next/static ./apps/viewer/.next/static
COPY --from=builder /app/apps/viewer/public ./apps/viewer/public
EXPOSE 3000
CMD ["node", "apps/viewer/server.js"]
