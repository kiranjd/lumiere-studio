import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../../stores/store';
import { ImageCard, ProcessingCard } from '../cards/ImageCard';
import { fetchGeneratedImages } from '../../api/server';
import { MODELS } from '../../utils/constants';

export function QueueView() {
  const queue = useStore((s) => s.queue);
  const generatedImages = useStore((s) => s.generatedImages);
  const setGeneratedImages = useStore((s) => s.setGeneratedImages);
  const generatedLoading = useStore((s) => s.generatedLoading);
  const setGeneratedLoading = useStore((s) => s.setGeneratedLoading);
  const openLightbox = useStore((s) => s.openLightbox);
  const selectedRefs = useStore((s) => s.selectedRefs);
  const toggleRef = useStore((s) => s.toggleRef);
  const assessments = useStore((s) => s.assessments);
  const compareImages = useStore((s) => s.compareImages);
  const toggleCompare = useStore((s) => s.toggleCompare);
  const incognitoImages = useStore((s) => s.incognitoImages);
  const incognitoMode = useStore((s) => s.incognitoMode);
  const viewingIncognitoCollection = useStore((s) => s.viewingIncognitoCollection);

  // Load generated images on mount
  useEffect(() => {
    const load = async () => {
      setGeneratedLoading(true);
      try {
        const images = await fetchGeneratedImages();
        setGeneratedImages(images);
      } catch (e) {
        console.error('Failed to load generated images:', e);
      }
      setGeneratedLoading(false);
    };
    load();
  }, []);

  // Filter queue to only show active items (pending/processing)
  const activeQueue = queue.filter(
    (q) => q.status === 'pending' || q.status === 'processing'
  );

  // Filter images based on incognito mode and viewing state
  const visibleImages = viewingIncognitoCollection
    ? generatedImages.filter((img) => incognitoImages.includes(img.file))
    : incognitoMode
      ? generatedImages
      : generatedImages.filter((img) => !incognitoImages.includes(img.file));

  const hasContent = activeQueue.length > 0 || visibleImages.length > 0;

  const handleOpenLightbox = (index: number) => {
    const images = visibleImages.map((img) => ({
      file: img.file,
      prompt: img.prompt,
      model: img.model,
    }));
    openLightbox(images, index, 'queue');
  };

  if (generatedLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-3 text-sm">Loading images...</p>
        </div>
      </div>
    );
  }

  if (!hasContent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm"
        >
          <div className="w-16 h-16 rounded-2xl bg-bg-3 border border-border flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-text mb-2">No images yet</h3>
          <p className="text-text-3 text-sm mb-6">
            Select references from the library, write a prompt, and generate your first images.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
            <kbd className="px-2 py-1 rounded bg-bg-3 border border-border">Cmd</kbd>
            <span>+</span>
            <kbd className="px-2 py-1 rounded bg-bg-3 border border-border">Enter</kbd>
            <span className="ml-2">to generate</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-32">
      {/* Processing queue - horizontal row at top */}
      {activeQueue.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b border-border">
          {activeQueue.map((item) => {
            const model = MODELS.find((m) => m.id === item.model);
            return (
              <ProcessingCard
                key={item.id}
                model={model?.name || item.model}
                status={item.status as 'pending' | 'processing'}
              />
            );
          })}
        </div>
      )}

      {/* Generated images - uniform grid flowing left-to-right */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {visibleImages.map((img, index) => (
          <div
            key={img.file}
            className="aspect-[3/4] rounded-lg overflow-hidden"
            style={{
              animation: index < 20
                ? `scale-in 0.3s ease-out ${Math.min(index * 0.02, 0.3)}s backwards`
                : undefined,
            }}
          >
            <ImageCard
              file={img.file}
              index={index}
              onOpen={() => handleOpenLightbox(index)}
              onSelect={() => toggleRef(img.file)}
              isSelected={selectedRefs.includes(img.file)}
              isComparing={compareImages.includes(img.file)}
              onToggleCompare={() => toggleCompare(img.file)}
              assessment={assessments[img.file]}
              prompt={img.prompt}
              model={img.model}
              fixedAspect
            />
          </div>
        ))}
      </div>
    </div>
  );
}
