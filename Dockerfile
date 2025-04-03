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
RUN npm run build

# Verify that Prisma directories exist
RUN ls -la /app/node_modules/.prisma || echo "Prisma directory does not exist"
RUN ls -la /app/node_modules/@prisma || echo "Prisma directory does not exist"

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

# Copy Prisma directories if they exist (with fallback logic)
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.prisma* ./node_modules/./
COPY --from=builder --chown=appuser:appgroup /app/node_modules/@prisma ./node_modules/@prisma

# Alternative approach: generate Prisma client in production stage
RUN if [ ! -d "./node_modules/.prisma" ]; then \
      echo "Prisma directory not found in builder stage, generating in production stage" && \
      npx prisma generate; \
    fi

# Expose application port
EXPOSE 8000

# Use dumb-init as entrypoint to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./scripts/docker-entrypoint.sh", "node", "dist/main.js"]
