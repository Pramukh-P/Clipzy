# 📋 Clipzy — Complete Setup & Deployment Guide

> YouTube & Instagram Video Downloader  
> Stack: MongoDB-ready Express backend + React frontend  
> Deploy: **Render** (backend) + **Netlify** (frontend)

---

## 📁 Project Structure

```
Clipzy/
├── package.json              ← Root convenience scripts
├── netlify.toml              ← Netlify build config
├── .gitignore
│
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── .gitignore
│   └── src/
│       ├── server.js         ← Express entry point
│       ├── routes/
│       │   ├── health.js     ← GET /api/health (wake-up ping)
│       │   ├── youtube.js    ← GET /api/youtube/info, /download
│       │   └── instagram.js  ← GET /api/instagram/info, /download
│       ├── controllers/
│       │   ├── youtube.js    ← YouTube logic
│       │   └── instagram.js  ← Instagram proxy logic
│       └── utils/
│           ├── youtube.js    ← ytdl-core helpers
│           └── instagram.js  ← Instagram scraping helpers
│
└── frontend/
    ├── package.json
    ├── .env.example
    ├── .gitignore
    ├── public/
    │   ├── index.html
    │   ├── manifest.json
    │   └── _redirects        ← Netlify SPA routing
    └── src/
        ├── index.js
        ├── App.jsx            ← Router + WakeUp logic
        ├── App.css            ← All styles
        ├── components/
        │   ├── Navbar.jsx
        │   └── WakeUpLoader.jsx
        ├── pages/
        │   ├── Home.jsx       ← Landing page with big platform buttons
        │   ├── YouTube.jsx    ← YouTube downloader
        │   └── Instagram.jsx  ← Instagram downloader
        ├── hooks/
        │   └── useWakeUp.js   ← Render cold-start hook
        └── utils/
            ├── api.js         ← Axios + API helpers
            └── helpers.js     ← Formatting utils
```

---

## ⚙️ Prerequisites

Make sure you have these installed:

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| Git | any | `git --version` |

## 🔧 Installing yt-dlp (Required)

Clipzy uses **yt-dlp** (not a Node.js library) to reliably download YouTube content. You must install it before running the backend.

### Windows
```bash
# Option A: pip (recommended if Python is installed)
pip install yt-dlp

# Option B: Download binary
# Go to https://github.com/yt-dlp/yt-dlp/releases/latest
# Download yt-dlp.exe → place it in C:\Windows\System32 or anywhere in your PATH
```

### macOS
```bash
brew install yt-dlp
# OR
pip install yt-dlp
```

### Linux / WSL
```bash
pip install yt-dlp
# OR
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

### Verify installation
```bash
yt-dlp --version
# Should print something like: 2024.xx.xx
```

> ⚠️ Without yt-dlp installed, YouTube downloads will return a 500 error.

---

---

## 🏠 Running Locally (localhost)

### Step 1 — Clone & Install

```bash
# Clone the repo (or unzip the project)
cd Clipzy

# Install all dependencies at once
npm run install:all

# OR install manually:
cd backend && npm install
cd ../frontend && npm install
```

### Step 2 — Configure Backend Environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
# Optional: Instagram session cookie for private content
INSTAGRAM_SESSION_ID=
```

### Step 3 — Configure Frontend Environment

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_BACKEND_URL=http://localhost:5000
```

### Step 4 — Start the Backend

Open **Terminal 1**:
```bash
cd Clipzy/backend
npm run dev
```

You should see:
```
🚀 Clipzy backend running on port 5000
🌍 Environment: development
```

Test it: http://localhost:5000/api/health

### Step 5 — Start the Frontend

Open **Terminal 2**:
```bash
cd Clipzy/frontend
npm start
```

The browser will open automatically at **http://localhost:3000**

> ℹ️ The frontend proxies API calls to localhost:5000 via the `"proxy"` field in `frontend/package.json`. No CORS issues in dev.

---

## 🧪 Testing Locally

### Test YouTube
1. Go to http://localhost:3000/youtube
2. Paste any public YouTube URL, e.g.:
   - `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
   - `https://youtu.be/dQw4w9WgXcQ`
   - YouTube Shorts: `https://www.youtube.com/shorts/...`
3. Click **Get Formats**
4. Choose a quality and click **Download**

### Test Instagram
1. Go to http://localhost:3000/instagram
2. Paste a **public** Instagram post URL, e.g.:
   - Post: `https://www.instagram.com/p/SHORTCODE/`
   - Reel: `https://www.instagram.com/reel/SHORTCODE/`
3. Click **Get Post**
4. Select items and click **Download Selected**

### Test Health API directly
```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/health/ping
```

---

## 🚀 Deploying to Production

### Part A: Deploy Backend to Render

#### 1. Push to GitHub
```bash
# In the Clipzy root
git init
git add .
git commit -m "Initial commit: Clipzy"
git remote add origin https://github.com/YOUR_USERNAME/clipzy.git
git push -u origin main
```

#### 2. Create a Render Web Service
1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub repo
3. Configure the service:

| Setting | Value |
|---------|-------|
| **Name** | `clipzy-backend` |
| **Root Directory** | `backend` |
| **Environment** | `Node` |
| **Build Command** | `bash render-build.sh` |
| **Start Command** | `npm start` |
| **Instance Type** | Free |

#### 3. Set Environment Variables on Render
In your Render service → **Environment** tab, add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `5000` (Render auto-sets this, but add it anyway) |
| `FRONTEND_URL` | `https://YOUR-SITE.netlify.app` (update after Netlify deploy) |
| `INSTAGRAM_SESSION_ID` | *(optional — leave blank)* |

#### 4. Deploy
Click **Deploy** and wait ~3 minutes. Your backend URL will be:
```
https://clipzy-backend.onrender.com
```

Test it: `https://clipzy-backend.onrender.com/api/health`

---

### Part B: Deploy Frontend to Netlify

#### 1. Set the API URL
Create `frontend/.env.production`:
```env
REACT_APP_API_URL=https://clipzy-backend.onrender.com
REACT_APP_BACKEND_URL=https://clipzy-backend.onrender.com
```
Commit and push this file.

#### 2. Deploy via Netlify CLI (option A)
```bash
npm install -g netlify-cli
cd frontend
npm run build
netlify deploy --prod --dir=build
```

#### 3. Deploy via Netlify Dashboard (option B)
1. Go to [netlify.com](https://netlify.com) → **New site from Git**
2. Connect your GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| **Base directory** | `frontend` |
| **Build command** | `npm run build` |
| **Publish directory** | `frontend/build` |

4. Add environment variable:
   - `REACT_APP_API_URL` → `https://clipzy-backend.onrender.com`

5. Click **Deploy site**

Your frontend URL will be: `https://some-name.netlify.app`

#### 4. Update Render CORS
Go back to Render → Environment Variables → update `FRONTEND_URL` to your Netlify URL:
```
FRONTEND_URL=https://your-site.netlify.app
```
Then **Manual Deploy** → **Deploy latest commit** on Render.

---

## 😴 Render Free Tier & Wake-Up Handling

Render's free tier **spins down** services after ~15 minutes of inactivity. The first request after sleeping can take **30–60 seconds**.

### How Clipzy handles this:
The frontend has a built-in **wake-up system**:
1. On app load, it immediately pings `/api/health/ping`
2. If no response → shows a beautiful animated **"Server is Waking Up"** loader
3. Retries every 5 seconds for up to 12 attempts (~60 seconds)
4. Once the server responds → loader disappears and app is usable
5. If all attempts fail → shows a **"Try Again"** button

### To keep the server warm (optional):
Use a free service like [cron-job.org](https://cron-job.org) to ping your backend every 10 minutes:
- URL: `https://clipzy-backend.onrender.com/api/health/ping`
- Interval: every 10 minutes
- This prevents the server from sleeping entirely.

---

## 🔧 Common Issues & Fixes

### "Failed to fetch video info"
- YouTube occasionally rate-limits or changes their API. Try again in 30 seconds.
- Some videos are region-locked or age-restricted and cannot be downloaded.

### "Could not fetch Instagram post"
- **Only public posts work.** Private accounts require authentication.
- Instagram aggressively rate-limits scrapers. If you get errors repeatedly, wait a few minutes.
- Make sure you're using the direct post/reel URL, not a story URL.

### CORS errors in browser console
- Make sure `FRONTEND_URL` in Render matches your Netlify URL exactly (including `https://`)
- No trailing slash in the URL

### Downloads not starting
- Browser popups might be blocked. Allow popups for your site.
- For large files, the download starts in the background — check your Downloads folder.

### "Cannot GET /youtube" on refresh (Netlify)
- This is fixed by the `_redirects` file in `frontend/public/`. Make sure it's committed.
- Or check `netlify.toml` has the redirects rule.

---

## 📦 Available API Endpoints

### Health
```
GET /api/health          → Server status + uptime
GET /api/health/ping     → Quick pong response
```

### YouTube
```
GET /api/youtube/info?url=<youtube_url>
  → Returns: { title, author, duration, viewCount, thumbnail, formats: { combined, videoOnly, audioOnly } }

GET /api/youtube/download?url=<url>&itag=<itag>&title=<title>&type=<type>
  → Streams: video/audio file download
```

### Instagram
```
GET /api/instagram/info?url=<instagram_url>
  → Returns: { shortcode, type, mediaCount, caption, author, mediaItems: [...] }

GET /api/instagram/download?mediaUrl=<cdnUrl>&filename=<name>
  → Proxies: media file download (bypasses CORS)
```

---

## 🛡️ Legal & Ethical Note

Clipzy is intended for **personal use only**:
- Only download content you have rights to or that is in the public domain
- Respect creator copyright and platform terms of service
- Do not use for commercial redistribution
- Instagram downloads only work for **public** posts

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, Framer Motion, react-hot-toast |
| Backend | Node.js, Express 4, @distube/ytdl-core, Axios |
| Styling | Custom CSS (no UI library) with CSS variables |
| Fonts | Syne (display) + DM Sans (body) via Google Fonts |
| Deploy: Backend | Render (free tier) |
| Deploy: Frontend | Netlify (free tier) |

---

## 📝 Quick Reference

```bash
# Dev: Start both servers
cd backend && npm run dev   # Terminal 1 → localhost:5000
cd frontend && npm start    # Terminal 2 → localhost:3000

# Production build
cd frontend && npm run build

# Install everything fresh
cd Clipzy && npm run install:all
```

---

*Made with ❤️ — Clipzy v1.0.0*
