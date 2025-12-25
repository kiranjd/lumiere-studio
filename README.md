# Lumière Studio

Tired of paying monthly subscriptions for image generation tools? Frustrated by the limited functionality in Gemini or ChatGPT apps? Same.

I built this for myself — a no-nonsense UI to generate images using my own API keys. No limits. No subscriptions. Just you, your keys, and a smooth interface to experiment freely.

<video src="https://github.com/kiranjd/lumiere-studio/raw/main/docs/demo.mp4" controls width="100%"></video>

## Why This Exists

- **Your keys, your rules** — Pay only for what you use. No monthly fees, no artificial limits.
- **Power-user first** — Keyboard shortcuts for everything. Navigate, select, batch, download — all without touching your mouse.
- **Experiment freely** — Generate across multiple models, compare results, iterate fast.
- **Clean UI** — No clutter, no upsells, no "upgrade to pro" popups. Just the tools you need.

## Features

- **Multi-model generation** — Run Gemini and GPT Image in parallel, compare results
- **Reference images** — Select up to 4 refs for character consistency
- **AI assessment** — Get feedback on generated images, retry with suggestions
- **Batch management** — Organize outputs into collections
- **Image editing** — Crop, rotate, flip inline
- **Keyboard-driven** — Full lightbox navigation with shortcuts

## Models

Currently supports:
- **Nano Banana Pro** (Gemini 2.5 Pro via OpenRouter)
- **GPT Image 1.5** (via OpenAI)
- **Z-Image Turbo** (via Replicate) — fast, cheap generations

Want more? The architecture supports adding providers easily. Open an issue or PR if you'd like to see:
- More Replicate models
- Stability AI
- Ideogram
- Other OpenRouter models

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [uv](https://docs.astral.sh/uv/) (fast Python package manager)
- API keys from [OpenRouter](https://openrouter.ai/) and [OpenAI](https://platform.openai.com/)

### Install

```bash
git clone https://github.com/kiranjd/lumiere-studio.git
cd lumiere-studio

# Backend
cd api
cp .env.example .env    # Add your API keys
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt

# Frontend
cd ../web
cp .env.example .env    # Add your API keys
npm install
```

### Run

```bash
# Terminal 1
cd api && source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2
cd web && npm run dev
```

Open http://localhost:5173

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` `→` | Navigate images |
| `R` | Toggle reference |
| `B` | Add to batch |
| `D` | Download |
| `E` | Edit |
| `A` | Assess |
| `Esc` | Close |

## Tech

- React + Vite + TypeScript + Tailwind
- FastAPI + Python
- OpenRouter + OpenAI APIs

## License

MIT — do whatever you want with it.
