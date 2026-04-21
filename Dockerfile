FROM node:lts-alpine

WORKDIR /app

# Copy package manifests first for layer caching
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Install all workspace dependencies (no Nixpacks cache mounts to conflict with)
RUN npm ci

# Copy only the source needed to build the server
COPY shared/ ./shared/
COPY server/ ./server/

RUN npm run build -w server

ENV NODE_ENV=production

CMD ["node", "server/dist/index.js"]
