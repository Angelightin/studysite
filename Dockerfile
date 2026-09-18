FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ENV NODE_ENV=production
ENV WRANGLER_SEND_METRICS=false

EXPOSE 3000

CMD ["sh", "./docker-entrypoint.sh"]

