# Multi-stage build for optimized production image
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with security audit
RUN npm ci --only=production && \
    npm audit --audit-level=moderate && \
    npm cache clean --force

# Copy source code
COPY . .

# Create production image
FROM node:18-alpine AS production

# Install security updates and create app user
RUN apk update && apk upgrade && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application
COPY --from=builder /app ./

# Create necessary directories with proper permissions
RUN mkdir -p /app/uploads /app/logs /app/temp && \
    chown -R nodejs:nodejs /app && \
    chmod -R 755 /app && \
    chmod 700 /app/uploads /app/logs /app/temp

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check with timeout
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1)).setTimeout(5000, () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "server.js"] 