FROM node:24-slim AS deps
WORKDIR /app
COPY services/results/package.json services/results/package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY services/results/package.json ./
COPY services/results/index.js ./
COPY services/results/src ./src
USER 1000
EXPOSE 8080
CMD ["node", "index.js"]