// Social media pipeline API calls

import { API } from '../utils/constants';

// Types
export interface SocialChannel {
  id: string;
  platform: string;
  name: string;
  identifier: string;
}

export interface PipelineStatus {
  status_counts: Record<string, number>;
  total: number;
  postiz_connected: boolean;
  scheduler_enabled: boolean;
  scheduler_running: boolean;
  error?: string;
}

export interface SendToAirtableParams {
  file: string;
  title: string;
  caption?: string;
  hashtags?: string;
  platforms: string[];
  scheduled_date?: string;
}

// Fetch connected social channels from Postiz
export async function fetchSocialChannels(): Promise<SocialChannel[]> {
  const res = await fetch(`${API.BASE}/api/social/channels`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to fetch channels' }));
    throw new Error(error.detail || 'Failed to fetch channels');
  }
  const data = await res.json();
  return data.channels;
}

// Get pipeline status (counts by status, scheduler info)
export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  const res = await fetch(`${API.BASE}/api/social/pipeline-status`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to fetch status' }));
    throw new Error(error.detail || 'Failed to fetch status');
  }
  return res.json();
}

// Send an image to Airtable for scheduling
export async function sendToAirtable(
  params: SendToAirtableParams
): Promise<{ success: boolean; record_id: string }> {
  const res = await fetch(`${API.BASE}/api/social/send-to-airtable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to send to Airtable' }));
    throw new Error(error.detail || 'Failed to send to Airtable');
  }
  return res.json();
}

// Manually trigger generation processing
export async function triggerGeneration(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API.BASE}/api/social/trigger-generation`, {
    method: 'POST',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to trigger generation' }));
    throw new Error(error.detail || 'Failed to trigger generation');
  }
  return res.json();
}

// Manually trigger scheduling processing
export async function triggerScheduling(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API.BASE}/api/social/trigger-scheduling`, {
    method: 'POST',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to trigger scheduling' }));
    throw new Error(error.detail || 'Failed to trigger scheduling');
  }
  return res.json();
}

// Platform display helpers
export const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  x: 'X (Twitter)',
  twitter: 'X (Twitter)',
  linkedin: 'LinkedIn',
  threads: 'Threads',
  tiktok: 'TikTok',
};

export const PLATFORM_ICONS: Record<string, string> = {
  instagram: 'camera',
  x: 'at-sign',
  twitter: 'at-sign',
  linkedin: 'briefcase',
  threads: 'message-circle',
  tiktok: 'video',
};

export function getPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform.toLowerCase()] || platform;
}

// Pending post from Airtable
export interface PendingPost {
  id: string;
  title: string;
  imageUrl: string;
  localPath?: string;
  caption: string;
  hashtags: string;
  platforms: string[];
  scheduledDate?: string;
  status: 'Review' | 'Approved' | 'Scheduled' | 'Published';
  createdAt: string;
}

// Fetch posts ready for publishing
export async function fetchPendingPosts(): Promise<PendingPost[]> {
  const res = await fetch(`${API.BASE}/api/social/pending-posts`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to fetch posts' }));
    throw new Error(error.detail || 'Failed to fetch posts');
  }
  const data = await res.json();
  return data.posts;
}

// Update post content
export async function updatePost(
  recordId: string,
  updates: {
    caption?: string;
    hashtags?: string;
    platforms?: string[];
    scheduled_date?: string;
    status?: string;
  }
): Promise<void> {
  const res = await fetch(`${API.BASE}/api/social/posts/${recordId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to update post' }));
    throw new Error(error.detail || 'Failed to update post');
  }
}

// Mark post as published
export async function markAsPosted(recordId: string): Promise<void> {
  const res = await fetch(`${API.BASE}/api/social/mark-posted/${recordId}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to mark as posted' }));
    throw new Error(error.detail || 'Failed to mark as posted');
  }
}

// Delete post from queue
export async function deletePost(recordId: string): Promise<void> {
  const res = await fetch(`${API.BASE}/api/social/posts/${recordId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to delete post' }));
    throw new Error(error.detail || 'Failed to delete post');
  }
}

// Generate caption and hashtags using AI
export async function generateCaption(
  file: string,
  platforms: string[] = ['Instagram'],
  context?: string
): Promise<{ caption: string; hashtags: string }> {
  const res = await fetch(`${API.BASE}/api/social/generate-caption`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file, platforms, context }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to generate caption' }));
    throw new Error(error.detail || 'Failed to generate caption');
  }
  return res.json();
}
