FROM node:24-slim AS deps
WORKDIR /app
COPY services/worker/package.json services/worker/package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-slim
ENV NODE_ENV=production
ENV CONTRACT_PATH=/app/contracts/job-message.v1.json
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY services/worker/package.json ./
COPY services/worker/index.js ./
COPY services/worker/src ./src
COPY contracts/job-message.v1.json ./contracts/job-message.v1.json
USER 1000
CMD ["node", "index.js"]