# Multi-stage build for production deployment

# Stage 1: Build frontend and backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY tsconfig.server.json ./
COPY vite.config.ts ./

# Install all dependencies (needed for build)
RUN npm ci

# Copy all source files
COPY . .

# Build both frontend and backend
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "dist/server/index.js"]
