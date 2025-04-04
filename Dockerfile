# ---------- Builder Stage ----------
  FROM node:20-alpine AS builder

  # Enable pnpm
  RUN corepack enable && corepack prepare pnpm@latest --activate
  
  WORKDIR /app
  
  # Install dependencies
  COPY package.json pnpm-lock.yaml ./
  ENV CI=true
  RUN pnpm install --frozen-lockfile
  
  # Copy source code
  COPY . .
  
  # Make scripts executable
  RUN chmod +x ./scripts/*.sh
  
  # Generate Prisma client and build the app
  RUN npx prisma generate && pnpm build
  
  
  # ---------- Production Stage ----------
  FROM node:20-alpine AS production
  
  # Install runtime deps
  RUN apk add --no-cache dumb-init bash netcat-openbsd
  
  # Add non-root user
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup
  USER appuser
  
  WORKDIR /app
  
  # Enable pnpm
  RUN corepack enable && corepack prepare pnpm@latest --activate
  
  # Copy only necessary files
  COPY --from=builder --chown=appuser:appgroup /app/package.json /app/pnpm-lock.yaml ./
  COPY --from=builder --chown=appuser:appgroup /app/scripts ./scripts
  COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma
  COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
  
  # Make scripts executable
  RUN chmod +x ./scripts/*.sh
  
  # Install production dependencies only
  ENV NODE_ENV=production
  ENV CI=true
  RUN pnpm install --frozen-lockfile --prod
  
  # Generate Prisma client again in case of missing .prisma files
  RUN npx prisma generate
  
  # Expose application port
  EXPOSE 8000
  
  # Entrypoint
  ENTRYPOINT ["/usr/bin/dumb-init", "--"]
  CMD ["./scripts/docker-entrypoint.sh", "node", "dist/main.js"]
  