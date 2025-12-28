# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Personal power-user tool for AI image generation with reference-based character consistency. The primary workflow: select reference images, write a prompt, generate across multiple models in parallel, review and organize results.

## Commands

```bash
# Quick start (recommended) - runs both backend and frontend
cd web && npm start

# Manual start
cd api && source venv/bin/activate && uvicorn main:app --reload --port 8000
cd web && npm run dev

# Lint frontend
cd web && npm run lint

# Build frontend
cd web && npm run build
```

Frontend: http://localhost:5173
Backend API docs: http://localhost:8000/docs

## Architecture

```
web/                      # React frontend (Vite + TypeScript + Tailwind v4)
├── src/
│   ├── api/              # API clients
│   │   ├── generation.ts # AI model integrations (OpenRouter, OpenAI, Replicate)
│   │   ├── server.ts     # Backend API calls
│   │   ├── assessment.ts # Image assessment via Gemini
│   │   └── social.ts     # Airtable/social media pipeline
│   ├── stores/store.ts   # Zustand store (persisted to localStorage)
│   ├── types/index.ts    # TypeScript types
│   ├── utils/constants.ts # Model configs, shortcuts, settings
│   └── components/
│       ├── views/        # Main views (Queue, Library, Batch, Archive, Publish)
│       ├── layout/       # Sidebar, Header, GeneratorIsland
│       ├── lightbox/     # Lightbox, ImageEditor, AssessmentPanel
│       └── ui/           # Reusable components

api/                      # FastAPI backend
├── main.py               # All routes: image CRUD, batches, social pipeline
├── generation_service.py # Server-side generation (caption generation)
└── integrations/         # Airtable client, orchestrator

beta/                     # Image assets (configurable via BETA_DIR env)
├── to-be-processed/      # Auto-saved generated images pending review
├── specific/             # Reference expression images
├── archive/              # Deleted images (soft delete)
└── manifest.json         # Library metadata
```

## Key Concepts

**State Management**: Single Zustand store in `stores/store.ts`. Key slices:
- `queue` - Generation queue with status tracking
- `library` / `generatedImages` - Image collections from server
- `batches` - User collections (synced to server via `batches.json`)
- `selectedRefs` - Up to 4 reference images for generation
- `lightbox` - Current lightbox state

**Image Flow**:
1. Generation request added to queue (`addToQueue`)
2. `processQueueItem` calls appropriate API (OpenRouter/OpenAI/Replicate)
3. Result saved to `beta/to-be-processed/` with sidecar JSON metadata
4. User reviews in Queue view, can add to batches or archive

**Models** (defined in `utils/constants.ts`):
- `google/gemini-3-pro-image-preview` - Via OpenRouter, supports refs
- `gpt-image-1.5` - Via OpenAI, supports refs
- `prunaai/z-image-turbo` - Via Replicate (proxied through backend), no refs

## Environment Variables

Frontend (`web/.env`):
- `VITE_OPENROUTER_API_KEY` - OpenRouter API key
- `VITE_OPENAI_API_KEY` - OpenAI API key

Backend (`api/.env`):
- `REPLICATE_API_TOKEN` - For Z-Image Turbo
- `AIRTABLE_PAT`, `AIRTABLE_BASE_ID` - Social media pipeline
- `BETA_DIR` - Override default image directory
- `SCHEDULER_ENABLED` - Enable/disable background jobs

## Keyboard Shortcuts

In Lightbox: `←/→` navigate, `R` toggle ref, `B` add to batch, `D` download, `E` edit, `A` assess, `Esc` close
