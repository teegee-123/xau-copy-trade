#!/bin/bash
set -e

echo "==> Installing root dependencies..."
npm install --prefer-offline

echo "==> Installing client dependencies..."
cd src/client
rm -rf node_modules package-lock.json
npm install

echo "==> Building client..."
npm run build

echo "==> Building server..."
cd ../..
npm run build:server

echo "==> Build complete!"
