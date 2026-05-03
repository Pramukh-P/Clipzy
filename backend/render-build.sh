#!/bin/bash
set -e

echo "Installing Node dependencies..."
npm install

echo "Installing yt-dlp binary..."

# Download yt-dlp binary
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp

# Make executable
chmod +x yt-dlp

# Move to PATH
mv yt-dlp /usr/local/bin/yt-dlp || mv yt-dlp /opt/render/project/src/yt-dlp

# Verify
echo "yt-dlp version: $(yt-dlp --version || echo 'not found')"

echo "Build complete!"