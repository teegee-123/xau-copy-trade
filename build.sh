#!/bin/bash
set -e

echo "==> Installing root dependencies..."
npm install

echo "==> Installing client dependencies..."
cd src/client
npm install

echo "==> Building client..."
npm run build

echo "==> Building server..."
cd ../..
npm run build:server

echo "==> Build complete!"
