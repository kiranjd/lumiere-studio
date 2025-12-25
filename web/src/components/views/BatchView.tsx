import { motion } from 'framer-motion';
import { useStore } from '../../stores/store';
import { ImageCard } from '../cards/ImageCard';

export function BatchView() {
  const batches = useStore((s) => s.batches);
  const activeBatchId = useStore((s) => s.activeBatchId);
  const openLightbox = useStore((s) => s.openLightbox);
  const selectedRefs = useStore((s) => s.selectedRefs);
  const toggleRef = useStore((s) => s.toggleRef);
  const removeImageFromBatch = useStore((s) => s.removeImageFromBatch);
  const assessments = useStore((s) => s.assessments);

  const batch = batches.find((b) => b.id === activeBatchId);

  if (!batch) {
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-text mb-2">No collection selected</h3>
          <p className="text-text-3 text-sm">Select a collection from the sidebar to view its images.</p>
        </motion.div>
      </div>
    );
  }

  if (batch.images.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm"
        >
          <div
            className="w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: `${batch.color}15`, borderColor: `${batch.color}30` }}
          >
            <span
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: batch.color }}
            />
          </div>
          <h3 className="text-lg font-medium text-text mb-2">{batch.name}</h3>
          <p className="text-text-3 text-sm mb-4">
            This collection is empty. Drag images here to add them.
          </p>
          <div className="text-xs text-text-muted">
            Drag from Generated or Library view
          </div>
        </motion.div>
      </div>
    );
  }

  const handleOpenLightbox = (index: number) => {
    const images = batch.images.map((img) => ({
      file: img.file,
    }));
    openLightbox(images, index, 'batch');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Batch header */}
      <div
        className="px-6 py-3 border-b flex items-center gap-3"
        style={{ borderColor: `${batch.color}30`, backgroundColor: `${batch.color}08` }}
      >
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: batch.color }}
        />
        <h2 className="text-sm font-medium text-text">{batch.name}</h2>
        <span className="text-xs text-text-3">{batch.images.length} images</span>
      </div>

      {/* Image grid - same masonry layout as library */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-32">
        <div className="masonry-grid">
          {batch.images.map((img, index) => (
            <div key={img.file} className="relative group">
              <ImageCard
                file={img.file}
                index={index}
                onOpen={() => handleOpenLightbox(index)}
                onSelect={() => toggleRef(img.file)}
                isSelected={selectedRefs.includes(img.file)}
                assessment={assessments[img.file]}
              />
              {/* Remove button */}
              <button
                onClick={() => removeImageFromBatch(batch.id, img.file)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-err text-void
                         flex items-center justify-center opacity-0 group-hover:opacity-100
                         transition-opacity shadow-lg hover:scale-110"
                title="Remove from collection"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
