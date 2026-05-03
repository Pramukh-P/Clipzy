#!/bin/bash
# Render build script - installs yt-dlp binary
set -e

echo "Installing Node dependencies..."
npm install

echo "Installing yt-dlp..."
pip install yt-dlp 2>/dev/null || pip3 install yt-dlp 2>/dev/null || {
  # Fallback: download binary directly
  curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
  chmod a+rx /usr/local/bin/yt-dlp
}

echo "yt-dlp version: $(yt-dlp --version 2>/dev/null || echo 'not found')"
echo "Build complete!"
