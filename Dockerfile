# Single-stage Dockerfile for XAU Copy Trade Dashboard
FROM node:20-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY src/client/package*.json ./src/client/

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build client
WORKDIR /app/src/client
RUN npm run build

# Build server
WORKDIR /app
RUN npm run build:server

# Create data and logs directories
RUN mkdir -p /app/data /app/logs

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
