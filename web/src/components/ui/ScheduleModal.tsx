import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from './Button';
import { sendToAirtable, getPlatformLabel, generateCaption } from '../../api/social';
import { getImageUrl } from '../../api/server';
import { useStore } from '../../stores/store';

interface ScheduleModalProps {
  file: string;
  prompt?: string;
  onClose: () => void;
}

const PLATFORMS = ['Instagram', 'X', 'LinkedIn'] as const;

export function ScheduleModal({ file, prompt, onClose }: ScheduleModalProps) {
  const addToast = useStore((s) => s.addToast);

  const [title, setTitle] = useState(
    prompt?.slice(0, 50) || file.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Untitled'
  );
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['Instagram']);
  const [scheduledDate, setScheduledDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateCaption = async () => {
    setIsGenerating(true);
    try {
      const result = await generateCaption(file, selectedPlatforms, prompt);
      setCaption(result.caption);
      setHashtags(result.hashtags);
      addToast({ message: 'Caption generated!', type: 'success' });
    } catch (error) {
      addToast({
        message: error instanceof Error ? error.message : 'Failed to generate caption',
        type: 'error',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      addToast({ message: 'Please enter a title', type: 'error' });
      return;
    }
    if (selectedPlatforms.length === 0) {
      addToast({ message: 'Please select at least one platform', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      await sendToAirtable({
        file,
        title: title.trim(),
        caption: caption.trim() || undefined,
        hashtags: hashtags.trim() || undefined,
        platforms: selectedPlatforms,
        scheduled_date: scheduledDate || undefined,
      });

      addToast({
        message: `Sent to Airtable for review`,
        type: 'success',
      });
      onClose();
    } catch (error) {
      addToast({
        message: error instanceof Error ? error.message : 'Failed to schedule',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-void/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-bg-2 border border-border rounded-xl shadow-2xl overflow-hidden max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold-dim flex items-center justify-center">
              <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-medium text-text">Schedule Post</h3>
              <p className="text-sm text-text-3">Send to Airtable for review</p>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex gap-3">
            <img
              src={getImageUrl(file)}
              alt=""
              className="w-20 h-20 rounded-lg object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-3 mb-1">Image</p>
              <p className="text-sm text-text truncate">
                {file.split('/').pop()}
              </p>
              {prompt && (
                <p className="text-xs text-text-3 mt-1 line-clamp-2">{prompt}</p>
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-text-2 mb-1.5">
              Title <span className="text-err">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief title for this post"
              className="w-full px-3 py-2 rounded-lg bg-bg-3 border border-border text-text text-sm
                       placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
            />
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-medium text-text-2 mb-1.5">
              Platforms <span className="text-err">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform}
                  onClick={() => togglePlatform(platform)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${selectedPlatforms.includes(platform)
                      ? 'bg-gold text-void'
                      : 'bg-bg-3 border border-border text-text-2 hover:border-border-2'
                    }
                  `}
                >
                  {getPlatformLabel(platform)}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Caption Button */}
          <button
            onClick={handleGenerateCaption}
            disabled={isGenerating}
            className="w-full py-2.5 rounded-lg bg-bg-3 border border-border text-text-2 text-sm font-medium
                     hover:bg-bg-4 hover:text-text hover:border-gold/50 transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Caption with AI
              </>
            )}
          </button>

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-text-2 mb-1.5">
              Caption
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-bg-3 border border-border text-text text-sm
                       placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold
                       resize-none"
            />
          </div>

          {/* Hashtags */}
          <div>
            <label className="block text-sm font-medium text-text-2 mb-1.5">
              Hashtags
            </label>
            <input
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#art #photography #creative"
              className="w-full px-3 py-2 rounded-lg bg-bg-3 border border-border text-text text-sm
                       placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
            />
          </div>

          {/* Scheduled Date */}
          <div>
            <label className="block text-sm font-medium text-text-2 mb-1.5">
              Schedule For
            </label>
            <input
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg-3 border border-border text-text text-sm
                       focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold
                       [color-scheme:dark]"
            />
            <p className="text-xs text-text-3 mt-1">
              Leave empty for manual scheduling in Airtable
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting || selectedPlatforms.length === 0}
            className="flex-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send to Airtable
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
