#!/bin/sh
set -e

# Wait for database to be ready (installed via apk in Dockerfile)
echo "Waiting for PostgreSQL to be ready..."
/app/scripts/wait-for-it.sh postgres:5432 -t 60

# Wait for Redis to be ready
echo "Waiting for Redis to be ready..."
/app/scripts/wait-for-it.sh redis:6379 -t 60

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Start the application
echo "Starting NestJS application..."
exec "$@"
