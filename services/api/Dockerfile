FROM node:24-slim AS deps
WORKDIR /app
COPY services/api/package.json services/api/package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY services/api/package.json ./
COPY services/api/index.js ./
COPY services/api/src ./src
USER 1000
EXPOSE 8080
CMD ["node", "index.js"]