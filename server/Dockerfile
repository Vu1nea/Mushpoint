FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:26-slim
ENV NODE_ENV=production
# The upstream tag lags Debian security fixes (e.g. zlib CVE-2026-85091 on
# node:26-slim), so take them at build time.
RUN apt-get update && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
# The runtime only needs `node`. The bundled npm/npx/corepack carry their own
# dependency CVEs and give an attacker in the container a package manager.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
# The same image runs migrations with: node dist/db/migrateCli.js
CMD ["node", "dist/main.js"]
