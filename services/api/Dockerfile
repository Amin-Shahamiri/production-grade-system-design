FROM node:26-slim AS deps
WORKDIR /app
COPY services/api/package.json services/api/package-lock.json ./
RUN npm ci --omit=dev

FROM node:26-slim
ENV NODE_ENV=production
WORKDIR /app
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
COPY --from=deps /app/node_modules ./node_modules
COPY services/api/package.json ./
COPY services/api/index.js ./
COPY services/api/src ./src
USER 1000
EXPOSE 8080
CMD ["node", "index.js"]