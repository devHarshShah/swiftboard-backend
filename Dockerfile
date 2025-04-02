FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package.json and related files first for better layer caching
COPY package.json pnpm-lock.yaml ./

# Disable Husky during CI/Docker builds and install dependencies
ENV CI=true
RUN pnpm install --frozen-lockfile

# Copy application code
COPY . .

# Make scripts executable
RUN chmod +x ./scripts/*.sh

# Generate Prisma client and build the application
RUN npx prisma generate
RUN pnpm build

# Production stage
FROM node:20-alpine AS production

# Install packages needed for production
RUN apk add --no-cache dumb-init bash netcat-openbsd

# Set up non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

WORKDIR /app

# Copy package files
COPY --from=builder --chown=appuser:appgroup /app/package.json /app/pnpm-lock.yaml ./

# Copy scripts directory
COPY --from=builder --chown=appuser:appgroup /app/scripts ./scripts
RUN chmod +x ./scripts/*.sh

# Only install production dependencies
ENV CI=true
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile --prod

# Copy built application files
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=appuser:appgroup /app/node_modules/@prisma ./node_modules/@prisma

# Expose application port
EXPOSE 8000

# Use dumb-init as entrypoint to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./scripts/docker-entrypoint.sh", "node", "dist/main.js"]
