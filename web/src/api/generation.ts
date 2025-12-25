// Image generation APIs

import { getImageUrl, imageToBase64, saveImage } from './server';
import type { QueueItem } from '../types';

// API Keys from environment
const OR_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const OAI_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

// Models
const MODELS = {
  GEMINI_IMAGE: 'google/gemini-3-pro-image-preview',
  GEMINI_ASSESS: 'google/gemini-3-flash-preview',
  GPT_IMAGE: 'gpt-image-1.5',
  FLUX: 'black-forest-labs/flux.2-pro',
  Z_IMAGE_TURBO: 'prunaai/z-image-turbo',
  QWEN_IMAGE_EDIT: 'qwen/qwen-image-edit-2511',
};

// Size mappings for OpenAI
const OAI_SIZES: Record<string, string> = {
  '1:1': '1024x1024',
  '16:9': '1792x1024',
  '9:16': '1024x1792',
  '4:3': '1536x1024',
  '3:4': '1024x1536',
  'low': '1024x1024',
  'medium': '1024x1536',
  'high': '1024x1536',
};

// Size mappings for Replicate (width x height)
const REPLICATE_SIZES: Record<string, { width: number; height: number }> = {
  '1:1': { width: 768, height: 768 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 },
  '4:3': { width: 896, height: 672 },
  '3:4': { width: 672, height: 896 },
};

// Store failed responses for debugging (accessible from console)
(window as any).__failedResponses = (window as any).__failedResponses || [];

function logFailedResponse(context: string, response: any) {
  const entry = {
    timestamp: new Date().toISOString(),
    context,
    response,
  };
  (window as any).__failedResponses.push(entry);
  console.error(`[Generation Error] ${context}:`, response);
  console.log('Access failed responses via: window.__failedResponses');

  // Also save to localStorage for persistence
  try {
    const saved = JSON.parse(localStorage.getItem('failedResponses') || '[]');
    saved.push(entry);
    // Keep last 20 entries
    localStorage.setItem('failedResponses', JSON.stringify(saved.slice(-20)));
  } catch (e) {
    // Ignore storage errors
  }
}

// Quality settings for each model type
const QUALITY_CONFIG = {
  low: { openai: 'low', flux_steps: 15, gemini_size: '1K' },
  medium: { openai: 'medium', flux_steps: 28, gemini_size: '1K' },
  high: { openai: 'high', flux_steps: 50, gemini_size: '2K' },
} as const;

// Generate with OpenRouter (Gemini, Flux)
export async function generateWithOpenRouter(params: {
  model: string;
  prompt: string;
  refs: string[];
  aspect: string;
  quality: 'low' | 'medium' | 'high';
}): Promise<string> {
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

  // Add reference images
  for (const ref of params.refs) {
    const url = getImageUrl(ref);
    const base64 = await imageToBase64(url);
    content.push({ type: 'image_url', image_url: { url: base64 } });
  }

  // Add prompt
  const promptText = params.refs.length > 0 ? `Using refs: ${params.prompt}` : params.prompt;
  content.push({ type: 'text', text: promptText });

  // Build request body with model-specific quality settings
  const isFlux = params.model.includes('flux');
  const isGemini = params.model.includes('gemini');
  const qualityConfig = QUALITY_CONFIG[params.quality];

  // Build image_config with aspect ratio and Gemini-specific image_size
  const imageConfig: Record<string, string> = {
    aspect_ratio: params.aspect,
  };

  if (isGemini) {
    imageConfig.image_size = qualityConfig.gemini_size;
  }

  const requestBody: Record<string, any> = {
    model: params.model,
    messages: [{ role: 'user', content: params.refs.length ? content : params.prompt }],
    modalities: ['text', 'image'],
    image_config: imageConfig,
  };

  // Add Flux-specific quality settings (num_inference_steps)
  if (isFlux) {
    requestBody.provider = {
      flux: {
        num_inference_steps: qualityConfig.flux_steps,
      },
    };
  }

  console.log('[OpenRouter] Request:', { model: params.model, prompt: params.prompt, refsCount: params.refs.length, quality: params.quality, isFlux, isGemini, imageConfig });

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OR_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await res.json();
  console.log('[OpenRouter] Full response:', data);

  if (data.error) {
    logFailedResponse('OpenRouter API Error', { request: requestBody, response: data });
    throw new Error(data.error.message);
  }

  // Extract image - matching original studio.html logic exactly
  // data.choices[0].message.images[0] -> image_url.url or url or direct value
  const message = data.choices?.[0]?.message;

  if (!message) {
    logFailedResponse('OpenRouter No Message', { request: requestBody, response: data });
    throw new Error('No message in response');
  }

  // Try images array first (Gemini format)
  const img = message.images?.[0];
  if (img) {
    const imageUrl = img?.image_url?.url || img?.url || img;
    if (imageUrl && typeof imageUrl === 'string') {
      console.log('[OpenRouter] Found image in images array');
      return imageUrl;
    }
  }

  // Try content array (alternative format)
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === 'image_url' && part.image_url?.url) {
        console.log('[OpenRouter] Found image in content array');
        return part.image_url.url;
      }
      if (part.type === 'image' && part.url) {
        console.log('[OpenRouter] Found image in content (image type)');
        return part.url;
      }
    }
  }

  // Try direct content if it's a data URL
  if (typeof message.content === 'string' && message.content.startsWith('data:image')) {
    console.log('[OpenRouter] Found image as direct content string');
    return message.content;
  }

  // Nothing found - log full response for debugging
  logFailedResponse('OpenRouter No Image Found', { request: requestBody, response: data });
  throw new Error('No image in response - check window.__failedResponses or localStorage.failedResponses');
}

// Generate with OpenAI (GPT Image)
export async function generateWithOpenAI(params: {
  prompt: string;
  refs: string[];
  quality: string;
  aspect: string;
}): Promise<string> {
  const size = OAI_SIZES[params.quality] || OAI_SIZES[params.aspect] || '1024x1024';

  // With references - use edits endpoint
  if (params.refs.length > 0) {
    const fd = new FormData();
    fd.append('model', MODELS.GPT_IMAGE);
    fd.append('prompt', `Using refs: ${params.prompt}`);
    fd.append('size', size);
    fd.append('quality', params.quality);
    fd.append('n', '1');

    // Add reference images
    for (const ref of params.refs) {
      const url = getImageUrl(ref);
      const response = await fetch(url);
      const blob = await response.blob();
      const mimeType = blob.type || 'image/png';
      fd.append('image[]', new File([blob], 'ref.png', { type: mimeType }));
    }

    console.log('[OpenAI Edits] Request:', { prompt: params.prompt, size, quality: params.quality, refsCount: params.refs.length });

    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OAI_KEY}` },
      body: fd,
    });

    const data = await res.json();
    console.log('[OpenAI Edits] Response:', data);

    if (data.error) {
      logFailedResponse('OpenAI Edits Error', { prompt: params.prompt, response: data });
      throw new Error(data.error.message);
    }

    const imageUrl = data.data?.[0]?.url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);
    if (!imageUrl) {
      logFailedResponse('OpenAI Edits No Image', { prompt: params.prompt, response: data });
      throw new Error('No image in response');
    }
    return imageUrl;
  }

  // Without references - use generations endpoint
  const requestBody = {
    model: MODELS.GPT_IMAGE,
    prompt: params.prompt,
    n: 1,
    size,
    quality: params.quality,
  };

  console.log('[OpenAI Gen] Request:', requestBody);

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await res.json();
  console.log('[OpenAI Gen] Response:', data);

  if (data.error) {
    logFailedResponse('OpenAI Gen Error', { request: requestBody, response: data });
    throw new Error(data.error.message);
  }

  const imageUrl = data.data?.[0]?.url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);
  if (!imageUrl) {
    logFailedResponse('OpenAI Gen No Image', { request: requestBody, response: data });
    throw new Error('No image in response');
  }
  return imageUrl;
}

// Quality to inference steps mapping for z-image-turbo
const REPLICATE_STEPS: Record<string, number> = {
  low: 4,
  medium: 8,
  high: 16,
};

// Generate with Replicate (z-image-turbo) via backend proxy
export async function generateWithReplicate(params: {
  prompt: string;
  aspect: string;
  quality: 'low' | 'medium' | 'high';
}): Promise<string> {
  const size = REPLICATE_SIZES[params.aspect] || REPLICATE_SIZES['1:1'];
  const steps = REPLICATE_STEPS[params.quality] || 8;

  const requestBody = {
    prompt: params.prompt,
    width: size.width,
    height: size.height,
    num_inference_steps: steps,
  };

  console.log('[Replicate] Request:', requestBody);

  // Use backend proxy to avoid CORS
  const res = await fetch('http://localhost:8000/api/replicate/z-image-turbo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await res.json();
  console.log('[Replicate] Response:', data);

  if (!res.ok) {
    logFailedResponse('Replicate API Error', { request: requestBody, response: data });
    throw new Error(data.detail || 'Replicate API error');
  }

  // Replicate returns output as array of URLs or single URL string
  const imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;
  if (!imageUrl || typeof imageUrl !== 'string') {
    logFailedResponse('Replicate No Image', { request: requestBody, response: data });
    throw new Error('No image in response');
  }

  return imageUrl;
}

// Process a single queue item
export async function processQueueItem(item: QueueItem): Promise<string> {
  const isOpenAI = item.model === MODELS.GPT_IMAGE;
  const isReplicate = item.model === MODELS.Z_IMAGE_TURBO;
  const quality = item.quality || 'medium'; // Fallback for older queue items

  if (isOpenAI) {
    return generateWithOpenAI({
      prompt: item.prompt,
      refs: item.refs,
      quality: QUALITY_CONFIG[quality].openai,
      aspect: item.aspect,
    });
  }

  if (isReplicate) {
    return generateWithReplicate({
      prompt: item.prompt,
      aspect: item.aspect,
      quality,
    });
  }

  return generateWithOpenRouter({
    model: item.model,
    prompt: item.prompt,
    refs: item.refs,
    aspect: item.aspect,
    quality,
  });
}

// Save generated image to server with metadata
export async function saveGeneratedImage(params: {
  imageUrl: string;
  prompt: string;
  model: string;
  refs?: string[];
  aspect?: string;
  quality?: string;
}): Promise<void> {
  let base64 = params.imageUrl;
  if (!params.imageUrl.startsWith('data:')) {
    base64 = await imageToBase64(params.imageUrl);
  }
  await saveImage({
    image: base64,
    prompt: params.prompt,
    model: params.model,
    refs: params.refs || [],
    aspect: params.aspect || '1:1',
    quality: params.quality || 'medium',
  });
}
