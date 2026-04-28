# ResumeAI

Production-ready website for ResumeAI.

AI-powered resume builder and LinkedIn job search tool. The frontend talks to a Python LangGraph backend that converts resumes to a FAANG-style FAANGPath layout and scrapes LinkedIn jobs via chat.

## Stack

- **Frontend**: React 18 + Vite + React Router v6
- **Backend**: Python + FastAPI + LangGraph + OpenAI + Apify
- **SEO**: Full meta tags, OG, Twitter Card, JSON-LD structured data, sitemap, robots.txt

## Setup

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your OPENAI_API_KEY and APIFY_API_TOKEN
python3 server.py
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:3001`. Vite proxies `/api/*` to the backend automatically.

## Production Deployment

**Recommended: [Vercel](https://vercel.com) (frontend) + [Railway](https://railway.app) or [Render](https://render.com) (backend)**

1. Deploy backend to Railway/Render, set Python env vars.
2. Deploy frontend to Vercel, set `VITE_API_BASE` to your backend URL.
3. Update `vite.config.js` proxy OR set the API URL directly in `Tool.jsx`.
4. Replace `yourdomain.com` in `index.html` and `sitemap.xml` with your real domain.

## SEO Keywords Targeted

- AI resume builder
- Free resume builder online
- FAANG resume template
- ATS-optimized resume
- Resume creator with AI
- LinkedIn job search tool
- Resume optimizer online
