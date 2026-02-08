FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY web/package.json web/

RUN npm ci

COPY . .

# Build shared package FIRST (creates packages/shared/dist/)
# Remove any stale tsbuildinfo to ensure clean build
RUN cd packages/shared && rm -f tsconfig.tsbuildinfo && npx tsc

# Verify shared package dist exists before proceeding
RUN test -f packages/shared/dist/index.js || (echo "SHARED BUILD FAILED" && exit 1)

# Build backend (creates dist/src/)
RUN npx tsc

# Verify backend dist exists
RUN test -f dist/src/api/server.js || (echo "BACKEND BUILD FAILED" && exit 1)

EXPOSE 3001
CMD ["node", "dist/src/api/server.js"]
