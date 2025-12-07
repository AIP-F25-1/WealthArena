# Multi-stage build for smaller image size
# Stage 1: Build TypeScript to JavaScript
# Use node:20-alpine and create non-root user for security
FROM node:20-alpine AS builder

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S wealtharena -u 1001 -G nodejs

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Production runtime with only compiled code
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy compiled code from builder stage with proper ownership
COPY --from=builder --chown=wealtharena:nodejs /app/dist ./dist

# Switch to non-root user for security
USER wealtharena

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["node", "dist/index.js"]


