import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../../stores/store';
import { fetchArchivedImages, restoreImage, permanentlyDeleteImage, getImageUrl } from '../../api/server';
import type { GeneratedImage } from '../../types';

export function ArchiveView() {
  const [archivedImages, setArchivedImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForDelete, setSelectedForDelete] = useState<string | null>(null);
  const addToast = useStore((s) => s.addToast);
  const setGeneratedImages = useStore((s) => s.setGeneratedImages);
  const generatedImages = useStore((s) => s.generatedImages);
  const zoom = useStore((s) => s.zoom);

  const loadArchive = async () => {
    setLoading(true);
    try {
      const images = await fetchArchivedImages();
      setArchivedImages(images);
    } catch (e) {
      console.error('Failed to load archive:', e);
      addToast({ message: 'Failed to load archive', type: 'error' });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadArchive();
  }, []);

  const handleRestore = async (file: string) => {
    const fileName = file.split('/').pop();
    if (!fileName) return;

    try {
      const result = await restoreImage(fileName);
      // Remove from archive list
      setArchivedImages((prev) => prev.filter((img) => img.file !== file));
      // Add to generated images
      setGeneratedImages([
        { file: result.restored, tags: ['generated', 'restored'] },
        ...generatedImages,
      ]);
      addToast({ message: 'Image restored', type: 'success' });
    } catch (e) {
      addToast({ message: 'Failed to restore image', type: 'error' });
    }
  };

  const handlePermanentDelete = async (file: string) => {
    const fileName = file.split('/').pop();
    if (!fileName) return;

    try {
      await permanentlyDeleteImage(fileName);
      setArchivedImages((prev) => prev.filter((img) => img.file !== file));
      setSelectedForDelete(null);
      addToast({ message: 'Permanently deleted', type: 'success' });
    } catch (e) {
      addToast({ message: 'Failed to delete', type: 'error' });
    }
  };

  const baseHeight = 180;
  const size = Math.round(baseHeight * zoom);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-3 text-sm">Loading archive...</p>
        </div>
      </div>
    );
  }

  if (archivedImages.length === 0) {
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
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-text mb-2">Archive is empty</h3>
          <p className="text-text-3 text-sm">
            Deleted images will appear here for recovery.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-medium text-text">Archive</h2>
          <span className="text-sm text-text-3">{archivedImages.length} images</span>
        </div>
        <button
          onClick={loadArchive}
          className="p-2 rounded-lg hover:bg-bg-3 text-text-3 hover:text-text transition-colors"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Image grid */}
      <div className="flex-1 overflow-y-auto p-6 pb-32">
        <div className="flex flex-wrap gap-3">
          {archivedImages.map((img) => (
            <div
              key={img.file}
              className="relative group rounded-lg overflow-hidden border-2 border-transparent hover:border-border-2 transition-all"
              style={{ width: size, height: size }}
            >
              <img
                src={getImageUrl(img.file)}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />

              {/* Archived overlay */}
              <div className="absolute inset-0 bg-void/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-2">
                  {/* Restore button */}
                  <button
                    onClick={() => handleRestore(img.file)}
                    className="p-2 rounded-lg bg-ok text-void hover:bg-ok/90 transition-colors"
                    title="Restore"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </button>

                  {/* Permanent delete button */}
                  <button
                    onClick={() => setSelectedForDelete(img.file)}
                    className="p-2 rounded-lg bg-err text-white hover:bg-err/90 transition-colors"
                    title="Delete permanently"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Archive badge */}
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-bg-3/80 backdrop-blur-sm text-xs text-text-3">
                Archived
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm permanent delete modal */}
      {selectedForDelete && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-void/80 backdrop-blur-sm"
          onClick={() => setSelectedForDelete(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bg-2 border border-border rounded-xl shadow-2xl overflow-hidden max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-err-dim flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-err" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-medium text-text mb-1">Delete permanently?</h3>
                <p className="text-sm text-text-3">This cannot be undone.</p>
              </div>
            </div>

            <div className="px-5 pb-4">
              <img
                src={getImageUrl(selectedForDelete)}
                alt=""
                className="w-full h-32 rounded-lg object-cover"
              />
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setSelectedForDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-bg-3 border border-border text-text text-sm font-medium hover:bg-bg-4 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePermanentDelete(selectedForDelete)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-err text-white text-sm font-medium hover:bg-err/90 transition-colors"
              >
                Delete Forever
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
