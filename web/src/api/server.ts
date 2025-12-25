// Local server API calls

import type { GeneratedImage, LibraryImage, Batch } from '../types';
import { API } from '../utils/constants';

export async function fetchGeneratedImages(): Promise<GeneratedImage[]> {
  const res = await fetch(API.LOCAL_GENERATED);
  if (!res.ok) throw new Error('Failed to fetch generated images');
  return res.json();
}

export async function fetchLibrary(): Promise<LibraryImage[]> {
  const res = await fetch(API.LOCAL_LIBRARY);
  if (!res.ok) throw new Error('Failed to fetch library');
  return res.json();
}

export async function saveImage(params: {
  image: string;
  prompt: string;
  model: string;
  refs?: string[];
  aspect?: string;
  quality?: string;
}): Promise<{ success: boolean; filename: string; path: string }> {
  const res = await fetch(API.LOCAL_SAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to save image');
  return res.json();
}

export async function saveGridImage(params: {
  image: string;
  base_filename: string;
  index: number;
}): Promise<{ success: boolean; filename: string; path: string }> {
  const res = await fetch(`${API.BASE}/api/images/save-grid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to save grid image');
  return res.json();
}

export async function deleteImage(file: string): Promise<{ success: boolean; archived?: string }> {
  const res = await fetch(`${API.BASE}/api/images/${file}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete image');
  return res.json();
}

export async function fetchArchivedImages(): Promise<GeneratedImage[]> {
  const res = await fetch(`${API.BASE}/api/images/archive`);
  if (!res.ok) throw new Error('Failed to fetch archived images');
  return res.json();
}

export async function restoreImage(fileName: string): Promise<{ success: boolean; restored: string }> {
  const res = await fetch(`${API.BASE}/api/images/restore/${fileName}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to restore image');
  return res.json();
}

export async function permanentlyDeleteImage(fileName: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API.BASE}/api/images/archive/${fileName}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to permanently delete image');
  return res.json();
}

// Convert file path to full URL for display
export function getImageUrl(file: string): string {
  // If already a full URL or data URL, return as-is
  if (file.startsWith('http') || file.startsWith('data:')) {
    return file;
  }
  // Otherwise, prepend /beta/ for local files
  return `/beta/${file}`;
}

// Convert image URL to base64 data URL
export async function imageToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ============ Batch Sync ============

export async function fetchBatches(): Promise<Batch[]> {
  const res = await fetch('/api/batches');
  if (!res.ok) throw new Error('Failed to fetch batches');
  return res.json();
}

export async function syncBatches(batches: Batch[]): Promise<{ batches: Batch[]; merged_count: number }> {
  const res = await fetch('/api/batches/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batches }),
  });
  if (!res.ok) throw new Error('Failed to sync batches');
  return res.json();
}

export async function saveBatches(batches: Batch[]): Promise<{ success: boolean }> {
  const res = await fetch('/api/batches', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batches }),
  });
  if (!res.ok) throw new Error('Failed to save batches');
  return res.json();
}

// ============ Incognito Images ============

export async function fetchIncognitoImages(): Promise<string[]> {
  const res = await fetch('/api/incognito');
  if (!res.ok) return [];
  const data = await res.json();
  return data.images || [];
}

export async function saveIncognitoImages(images: string[]): Promise<void> {
  await fetch('/api/incognito', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images }),
  });
}

// ============ Image Tags ============

export async function updateImageTag(
  file: string,
  tag: string,
  action: 'add' | 'remove' = 'add'
): Promise<{ success: boolean }> {
  const res = await fetch('/api/images/tag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file, tag, action }),
  });
  if (!res.ok) throw new Error('Failed to update image tag');
  return res.json();
}
