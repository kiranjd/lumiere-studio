import type { ModelConfig } from '../types';

// Model configurations (matches original studio.html)
export const MODELS: ModelConfig[] = [
  {
    id: 'google/gemini-3-pro-image-preview',
    name: 'Gemini 3 Pro',
    provider: 'openrouter',
    costPer: 0,
    supportsRefs: true,
    maxRefs: 4,
  },
  {
    id: 'gpt-image-1.5',
    name: 'GPT Image 1.5',
    provider: 'openai',
    costPer: 0.02,
    supportsRefs: true,
    maxRefs: 4,
  },
];

// Batch colors
export const BATCH_COLORS = [
  '#d4a853', // gold
  '#4ade80', // green
  '#60a5fa', // blue
  '#f87171', // red
  '#a78bfa', // purple
  '#fbbf24', // amber
  '#2dd4bf', // teal
  '#fb7185', // pink
];

// Aspect ratios
export const ASPECT_RATIOS = {
  '1:1': { width: 1024, height: 1024, label: 'Square' },
  '16:9': { width: 1792, height: 1024, label: 'Landscape' },
  '9:16': { width: 1024, height: 1792, label: 'Portrait' },
  '4:3': { width: 1365, height: 1024, label: 'Classic' },
  '3:4': { width: 1024, height: 1365, label: 'Classic Portrait' },
} as const;

// Quality settings with model-specific parameters
export const QUALITY_SETTINGS = {
  low: {
    label: 'Draft',
    description: 'Fast & cheap for experiments',
    openai: { quality: 'low' },
    flux: { steps: 15 },
    gemini: { image_size: '1K' },
  },
  medium: {
    label: 'Standard',
    description: 'Balanced quality & cost',
    openai: { quality: 'medium' },
    flux: { steps: 28 },
    gemini: { image_size: '1K' },
  },
  high: {
    label: 'Quality',
    description: 'Best results, higher cost',
    openai: { quality: 'high' },
    flux: { steps: 50 },
    gemini: { image_size: '2K' },
  },
} as const;

// API endpoints
export const API = {
  BASE: 'http://localhost:8000',
  OPENROUTER: 'https://openrouter.ai/api/v1/chat/completions',
  OPENAI_IMAGES: 'https://api.openai.com/v1/images/generations',
  LOCAL_GENERATED: '/api/images/generated',
  LOCAL_SAVE: '/api/images/save',
  LOCAL_LIBRARY: '/api/images/library',
} as const;

// Keyboard shortcuts
export const SHORTCUTS = {
  GENERATE: 'Meta+Enter',
  LIGHTBOX_CLOSE: 'Escape',
  LIGHTBOX_PREV: 'ArrowLeft',
  LIGHTBOX_NEXT: 'ArrowRight',
  KEEP: 'k',
  SKIP: 's',
  BATCH: 'b',
  TAG: 't',
  ASSESS: 'a',
  DOWNLOAD: 'd',
  RETRY: 'r',
} as const;
