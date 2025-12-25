// Core domain types for Lumiere Studio

export type ViewType = 'queue' | 'library' | 'batch' | 'archive' | 'publish';

// Content ready to publish (from Airtable)
export interface PendingPost {
  id: string;
  title: string;
  imageUrl: string;
  localPath?: string;
  caption?: string;
  hashtags?: string;
  platforms: string[];
  scheduledDate?: string;
  status: 'Review' | 'Approved' | 'Scheduled' | 'Published';
  createdAt: string;
}

export type QueueStatus = 'pending' | 'processing' | 'done' | 'error';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface QueueItem {
  id: string;
  prompt: string;
  model: string;
  refs: string[];
  aspect: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  quality: QualityLevel;
  status: QueueStatus;
  imageUrl?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface GeneratedImage {
  file: string;
  tags: string[];
  prompt?: string;
  model?: string;
  refs?: string[];
  aspect?: string;
  quality?: string;
  createdAt?: string;
}

export interface LibraryImage {
  file: string;
  tags: string[];
  model?: string;
  prompt?: string;
}

export interface Batch {
  id: string;
  name: string;
  color: string;
  images: BatchImage[];
  createdAt: number;
}

export interface BatchImage {
  file: string;
  addedAt: number;
}

export interface Assessment {
  score: number;
  strengths: string[];
  weaknesses: string[];
  fixes: string[];
  timestamp: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'openrouter' | 'openai';
  costPer: number;
  supportsRefs: boolean;
  maxRefs: number;
}

// Generation options
export interface GenerationOptions {
  prompt: string;
  models: string[];
  refs: string[];
  quantity: number;
  aspect: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  quality: QualityLevel;
}

// Lightbox state
export interface LightboxState {
  isOpen: boolean;
  images: Array<{ file: string; prompt?: string; model?: string }>;
  currentIndex: number;
  source: 'queue' | 'library' | 'batch';
}

// Toast notification
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

// Prompt template
export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  createdAt: number;
}
