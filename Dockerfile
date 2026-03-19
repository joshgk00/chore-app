# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
RUN npm ci

# Stage 2: Build all packages
FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/client
RUN npm run build --workspace=packages/server

# Stage 3: Production runtime
FROM node:22-alpine AS runtime
RUN apk add --no-cache tini
WORKDIR /app

# Copy package manifests and install prod deps only
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/server/src/db/migrations ./packages/server/dist/db/migrations
COPY --from=build /app/packages/client/dist ./packages/client/dist

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
EXPOSE 3000
VOLUME ["/data"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "packages/server/dist/index.js"]
