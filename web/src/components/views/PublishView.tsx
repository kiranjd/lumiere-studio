import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../stores/store';
import { Button } from '../ui/Button';
import { InstagramPreview } from '../ui/InstagramPreview';
import {
  fetchPendingPosts,
  updatePost,
  markAsPosted,
  deletePost,
  getPlatformLabel,
  type PendingPost,
} from '../../api/social';

const PLATFORMS = ['Instagram', 'X', 'LinkedIn'] as const;

export function PublishView() {
  const addToast = useStore((s) => s.addToast);
  const [posts, setPosts] = useState<PendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch posts on mount
  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const data = await fetchPendingPosts();
      setPosts(data);
    } catch (error) {
      addToast({
        message: error instanceof Error ? error.message : 'Failed to load posts',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePost = async (id: string, updates: Partial<PendingPost>) => {
    try {
      await updatePost(id, {
        caption: updates.caption,
        hashtags: updates.hashtags,
        platforms: updates.platforms,
        status: updates.status,
      });
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
    } catch (error) {
      addToast({
        message: error instanceof Error ? error.message : 'Failed to update',
        type: 'error',
      });
    }
  };

  const handleMarkPosted = async (id: string) => {
    try {
      await markAsPosted(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      addToast({ message: 'Marked as posted!', type: 'success' });
    } catch (error) {
      addToast({
        message: error instanceof Error ? error.message : 'Failed to mark as posted',
        type: 'error',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this post from the queue?')) return;
    try {
      await deletePost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      addToast({ message: 'Post removed', type: 'info' });
    } catch (error) {
      addToast({
        message: error instanceof Error ? error.message : 'Failed to delete',
        type: 'error',
      });
    }
  };

  const copyToClipboard = async (post: PendingPost) => {
    const text = `${post.caption || ''}\n\n${post.hashtags || ''}`.trim();
    await navigator.clipboard.writeText(text);
    addToast({ message: 'Copied to clipboard!', type: 'success' });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-3">Loading posts...</div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full bg-bg-3 flex items-center justify-center">
          <svg className="w-8 h-8 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium text-text mb-1">No posts to publish</h3>
          <p className="text-sm text-text-3">
            Schedule images from the lightbox to see them here
          </p>
        </div>
        <Button variant="secondary" onClick={loadPosts}>
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-display text-text">Publish Queue</h2>
            <p className="text-sm text-text-3">{posts.length} posts ready</p>
          </div>
          <Button variant="secondary" onClick={loadPosts}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>

        {/* Post cards */}
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isExpanded={expandedId === post.id}
              onToggle={() => setExpandedId(expandedId === post.id ? null : post.id)}
              onUpdate={(updates) => handleUpdatePost(post.id, updates)}
              onCopy={() => copyToClipboard(post)}
              onMarkPosted={() => handleMarkPosted(post.id)}
              onDelete={() => handleDelete(post.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PostCardProps {
  post: PendingPost;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<PendingPost>) => void;
  onCopy: () => void;
  onMarkPosted: () => void;
  onDelete: () => void;
}

function PostCard({
  post,
  isExpanded,
  onToggle,
  onUpdate,
  onCopy,
  onMarkPosted,
  onDelete,
}: PostCardProps) {
  const addToast = useStore((s) => s.addToast);
  const [caption, setCaption] = useState(post.caption);
  const [hashtags, setHashtags] = useState(post.hashtags);
  const [platforms, setPlatforms] = useState(post.platforms);
  const [isDirty, setIsDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const handleSave = () => {
    onUpdate({ caption, hashtags, platforms });
    setIsDirty(false);
  };

  const togglePlatform = (platform: string) => {
    const newPlatforms = platforms.includes(platform)
      ? platforms.filter((p) => p !== platform)
      : [...platforms, platform];
    setPlatforms(newPlatforms);
    setIsDirty(true);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(post.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${post.title || 'post'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast({ message: 'Image downloaded!', type: 'success' });
    } catch {
      addToast({ message: 'Failed to download image', type: 'error' });
    }
  };

  return (
    <motion.div
      layout
      className="bg-bg-2 border border-border rounded-xl overflow-hidden"
    >
      {/* Collapsed view */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-bg-3 transition-colors"
        onClick={onToggle}
      >
        <img
          src={post.imageUrl}
          alt=""
          className="w-16 h-16 rounded-lg object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-text truncate">{post.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            {post.platforms.map((p) => (
              <span
                key={p}
                className="text-xs px-2 py-0.5 rounded bg-bg-4 text-text-2"
              >
                {getPlatformLabel(p)}
              </span>
            ))}
            <span className={`text-xs px-2 py-0.5 rounded ${
              post.status === 'Published' ? 'bg-ok-dim text-ok' :
              post.status === 'Approved' ? 'bg-blue-500/20 text-blue-400' :
              post.status === 'Scheduled' ? 'bg-gold-dim text-gold' :
              'bg-bg-4 text-text-3'
            }`}>
              {post.status === 'Published' && '✓ '}{post.status}
            </span>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-text-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded view */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border"
          >
            <div className="p-4">
              {/* Toggle Preview */}
              <div className="flex items-center justify-end mb-4">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    showPreview
                      ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                      : 'bg-bg-3 text-text-3 border border-border hover:text-text'
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  {showPreview ? 'Preview On' : 'Preview Off'}
                </button>
              </div>

              <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
                {/* Left: Edit Panel */}
                <div className="space-y-4">
                  {/* Platforms */}
                  <div>
                    <label className="block text-sm font-medium text-text-2 mb-2">
                      Platforms
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.map((platform) => (
                        <button
                          key={platform}
                          onClick={() => togglePlatform(platform)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            platforms.includes(platform)
                              ? 'bg-gold text-void'
                              : 'bg-bg-3 border border-border text-text-2 hover:border-border-2'
                          }`}
                        >
                          {getPlatformLabel(platform)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Caption */}
                  <div>
                    <label className="block text-sm font-medium text-text-2 mb-2">
                      Caption
                    </label>
                    <textarea
                      value={caption}
                      onChange={(e) => {
                        setCaption(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="Write your caption..."
                      rows={4}
                      className="w-full px-3 py-2 rounded-lg bg-bg-3 border border-border text-text text-sm
                               placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold
                               resize-none"
                    />
                  </div>

                  {/* Hashtags */}
                  <div>
                    <label className="block text-sm font-medium text-text-2 mb-2">
                      Hashtags
                    </label>
                    <input
                      type="text"
                      value={hashtags}
                      onChange={(e) => {
                        setHashtags(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="#art #photography #creative"
                      className="w-full px-3 py-2 rounded-lg bg-bg-3 border border-border text-text text-sm
                               placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    {isDirty && (
                      <Button variant="secondary" onClick={handleSave}>
                        Save Changes
                      </Button>
                    )}
                    <Button variant="secondary" onClick={handleDownload}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </Button>
                    <Button variant="secondary" onClick={onCopy}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Caption
                    </Button>
                    <Button variant="primary" onClick={onMarkPosted}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Mark Posted
                    </Button>
                    <div className="flex-1" />
                    <button
                      onClick={onDelete}
                      className="p-2 rounded-lg text-text-3 hover:text-err hover:bg-err-dim transition-colors"
                      title="Remove from queue"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Right: Instagram Preview */}
                {showPreview && (
                  <div className="flex flex-col items-center">
                    <p className="text-xs text-text-3 mb-3 uppercase tracking-wide">Instagram Preview</p>
                    <InstagramPreview
                      imageUrl={post.imageUrl}
                      caption={caption || ''}
                      hashtags={hashtags || ''}
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
