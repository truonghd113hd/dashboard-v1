# Một image: build web (Vite) rồi để API (Fastify) phục vụ luôn static + /api
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @dashboard/web build

FROM node:22-alpine
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production PORT=3001 DATA_DIR=/data WEB_DIST_DIR=/app/apps/web/dist
COPY --from=build /app /app
RUN mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
CMD ["pnpm", "--filter", "@dashboard/api", "start"]
