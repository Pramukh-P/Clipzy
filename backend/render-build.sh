#!/bin/bash
# Render build script
set -e

echo "Installing Node dependencies..."
npm install

echo "Installing latest yt-dlp binary..."
# Always download latest binary directly — pip version may be outdated
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp

echo "yt-dlp version: $(yt-dlp --version 2>/dev/null || echo 'not found')"
echo "ffmpeg version: $(ffmpeg -version 2>/dev/null | head -1 || echo 'not found')"
echo "Build complete!"
