#!/usr/bin/env bash
# Build script for Horizon18 frontend.
# Compiles JSX → plain JS so the browser doesn't need Babel at runtime.
#
# Usage:
#   ./build.sh          (one-time compile)
#
# Requires: Node.js + npm (installed once via package.json)

set -e

cd "$(dirname "$0")"

# Install Babel CLI if not present
if [ ! -d "node_modules" ]; then
  echo "Installing build dependencies..."
  npm install --silent
fi

# Compile JSX → JS
echo "Compiling frontend/app.jsx → frontend/app.js"
npx babel frontend/app.jsx --out-file frontend/app.js --presets=@babel/preset-react

echo "Build complete."
