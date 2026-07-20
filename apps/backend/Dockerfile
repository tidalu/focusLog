FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY contracts ./contracts
COPY apps/backend ./apps/backend

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @focuslog/backend prisma:generate
RUN pnpm --filter @focuslog/backend... build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend ./apps/backend
COPY --from=build /app/packages ./packages
COPY --from=build /app/contracts ./contracts
RUN chmod +x ./apps/backend/docker-entrypoint.sh && chown -R node:node /app

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.BACKEND_PORT || process.env.PORT || 3000) + '/health/ready').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["./apps/backend/docker-entrypoint.sh"]
CMD ["node", "apps/backend/dist/server.js"]
