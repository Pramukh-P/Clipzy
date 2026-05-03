#!/bin/bash
set -e

echo "Installing Node dependencies..."
npm install

echo "Installing Python + yt-dlp..."

# Ensure python + pip exist
apt-get update
apt-get install -y python3 python3-pip curl

# Install yt-dlp
pip3 install --no-cache-dir yt-dlp

# Verify installation
echo "yt-dlp version: $(yt-dlp --version || echo 'yt-dlp not found')"

echo "Build complete!"