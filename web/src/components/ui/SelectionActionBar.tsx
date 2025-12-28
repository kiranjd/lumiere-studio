import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDragSelection, clearDragSelect } from './DragLayer';
import { useStore } from '../../stores/store';
import { deleteImage } from '../../api/server';

export function SelectionActionBar() {
  const selectedFiles = useDragSelection();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBatchMenu, setShowBatchMenu] = useState(false);
  const lightbox = useStore((s) => s.lightbox);

  // Keyboard shortcut: Esc to clear selection
  useEffect(() => {
    if (selectedFiles.length < 2 || lightbox.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        clearDragSelect();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFiles.length, lightbox.isOpen]);

  const batches = useStore((s) => s.batches);
  const addImageToBatch = useStore((s) => s.addImageToBatch);
  const setRefs = useStore((s) => s.setRefs);
  const addToast = useStore((s) => s.addToast);
  const setLibrary = useStore((s) => s.setLibrary);
  const setGeneratedImages = useStore((s) => s.setGeneratedImages);

  const count = selectedFiles.length;

  if (count < 2) return null;

  const handleDelete = async () => {
    if (isDeleting) return;

    const confirmed = window.confirm(
      `Delete ${count} images? This will move them to the archive folder.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await Promise.all(selectedFiles.map((file) => deleteImage(file)));
      // Get fresh state and remove from both collections
      const state = useStore.getState();
      const deletedSet = new Set(selectedFiles);
      setLibrary(state.library.filter((img) => !deletedSet.has(img.file)));
      setGeneratedImages(state.generatedImages.filter((img) => !deletedSet.has(img.file)));
      addToast({ message: `Deleted ${count} images`, type: 'success' });
      clearDragSelect();
    } catch (error) {
      addToast({ message: 'Failed to delete some images', type: 'error' });
    }
    setIsDeleting(false);
  };

  const handleAddToBatch = (batchId: string) => {
    selectedFiles.forEach((file) => addImageToBatch(batchId, file));
    addToast({ message: `Added ${count} images to batch`, type: 'success' });
    setShowBatchMenu(false);
    clearDragSelect();
  };

  const handleSetAsReferences = () => {
    // Take up to 4 images as references
    const refs = selectedFiles.slice(0, 4);
    setRefs(refs);
    addToast({
      message: refs.length < count
        ? `Set ${refs.length} as references (max 4)`
        : `Set ${count} as references`,
      type: 'success'
    });
    clearDragSelect();
  };

  const handleClearSelection = () => {
    clearDragSelect();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      >
        <div className="flex items-center gap-2 px-4 py-3 bg-bg-2 border border-border rounded-2xl shadow-2xl shadow-black/40">
          {/* Selection count */}
          <div className="flex items-center gap-2 pr-3 border-r border-border">
            <div className="w-7 h-7 rounded-full bg-cyan flex items-center justify-center text-void text-sm font-bold">
              {count}
            </div>
            <span className="text-sm text-text-2">selected</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Set as References */}
            <button
              onClick={handleSetAsReferences}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                       text-gold hover:bg-gold/10 transition-colors"
              title="Set as references for generation"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <span className="hidden sm:inline">References</span>
            </button>

            {/* Add to Batch */}
            <div className="relative">
              <button
                onClick={() => setShowBatchMenu(!showBatchMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                         text-text hover:bg-bg-3 transition-colors"
                title="Add to batch"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="hidden sm:inline">Batch</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Batch dropdown */}
              <AnimatePresence>
                {showBatchMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute bottom-full left-0 mb-2 min-w-[160px]
                             bg-bg-3 border border-border rounded-lg shadow-xl overflow-hidden"
                  >
                    {batches.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-text-3">No batches</div>
                    ) : (
                      batches.map((batch) => (
                        <button
                          key={batch.id}
                          onClick={() => handleAddToBatch(batch.id)}
                          className="w-full px-3 py-2 text-left text-sm flex items-center gap-2
                                   hover:bg-bg-4 transition-colors"
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: batch.color }}
                          />
                          <span className="text-text">{batch.name}</span>
                          <span className="text-text-3 ml-auto">{batch.images.length}</span>
                        </button>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Delete */}
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                       text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              title="Delete selected images"
            >
              {isDeleting ? (
                <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>

          {/* Clear selection */}
          <div className="pl-2 border-l border-border">
            <button
              onClick={handleClearSelection}
              className="p-2 rounded-lg text-text-3 hover:text-text hover:bg-bg-3 transition-colors"
              title="Clear selection (Esc)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Hint text */}
        <div className="text-center mt-2">
          <span className="text-xs text-text-3">
            Cmd+Click to select more • Esc to clear
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
