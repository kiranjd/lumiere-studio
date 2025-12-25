# Lumière Studio

A power-user tool for generating consistent character images using AI models. Generate across multiple models in parallel, manage references, and iterate on results.

## Features

- **Multi-model generation** - Gemini, GPT Image, Flux running in parallel
- **Reference-based generation** - Select up to 4 reference images for character consistency
- **Image assessment** - AI feedback on generated images with retry workflow
- **Batch management** - Organize and persist collections
- **Image editing** - Crop, rotate, flip
- **Lightbox** - Keyboard navigation, quick actions

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Python
- **AI Models**: OpenRouter (Gemini, Flux) + OpenAI (GPT Image)

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- API keys from [OpenRouter](https://openrouter.ai/) and [OpenAI](https://platform.openai.com/)

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/lumiere-studio.git
cd lumiere-studio

# Backend
cd api
cp .env.example .env
# Edit .env and add your API keys
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt

# Frontend (new terminal)
cd web
cp .env.example .env
# Edit .env and add your API keys
npm install
```

### Running

```bash
# Terminal 1: Backend
cd api
source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd web
npm run dev
```

Open http://localhost:5173

## Configuration

### API Keys

You need API keys from:
- **OpenRouter** - For Gemini and Flux models
- **OpenAI** - For GPT Image model

Add them to both:
- `api/.env` - Backend uses `OPENROUTER_API_KEY` and `OPENAI_API_KEY`
- `web/.env` - Frontend uses `VITE_OPENROUTER_API_KEY` and `VITE_OPENAI_API_KEY`

## Keyboard Shortcuts (Lightbox)

| Key | Action |
|-----|--------|
| `←` `→` | Navigate images |
| `R` | Toggle reference selection |
| `B` | Add to batch |
| `D` | Download |
| `E` | Edit image |
| `A` | Assess image |
| `Esc` | Close lightbox |

## License

MIT
