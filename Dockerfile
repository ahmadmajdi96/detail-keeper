# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lockb* ./

# Install dependencies (use `npm install` so the container regenerates the
# lock file when package.json drifts from package-lock.json — the project's
# source of truth is bun.lockb, not package-lock.json, so `npm ci` would fail).
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 9832
EXPOSE 9832

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
