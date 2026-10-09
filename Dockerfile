#build frontend
FROM node:24-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

#build backend
FROM node:24-slim AS backend-build
WORKDIR /backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

#run image
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production

#dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY --from=backend-build /backend/dist ./dist
COPY --from=frontend-build /frontend/dist ./public
COPY backend/src/database/migrations ./migrations

EXPOSE 3000

#run pending migrations, then start server
CMD ["sh", "-c", "npx node-pg-migrate up -m migrations && node dist/main.js"]
