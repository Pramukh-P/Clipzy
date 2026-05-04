#!/bin/bash
# Render build script
set -e

echo "Installing Node dependencies..."
npm install

echo "Installing latest yt-dlp..."
# /usr/local/bin is read-only on Render — install to project-local bin dir
mkdir -p ./bin
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o ./bin/yt-dlp
chmod a+rx ./bin/yt-dlp

echo "yt-dlp version: $(./bin/yt-dlp --version 2>/dev/null || echo 'not found')"
echo "ffmpeg version: $(ffmpeg -version 2>/dev/null | head -1 || echo 'not found')"
echo "Build complete!"
