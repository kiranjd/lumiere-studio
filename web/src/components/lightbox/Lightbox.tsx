import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../stores/store';
import { cn } from '../../utils/cn';
import { getImageUrl, saveImage, saveGridImage, deleteImage } from '../../api/server';
import { Button } from '../ui/Button';
import { ImageEditor } from './ImageEditor';
import { AssessmentPanel } from './AssessmentPanel';
import { ScheduleModal } from '../ui/ScheduleModal';

export function Lightbox() {
  const lightbox = useStore((s) => s.lightbox);
  const closeLightbox = useStore((s) => s.closeLightbox);
  const setLightboxIndex = useStore((s) => s.setLightboxIndex);
  const setLightboxImages = useStore((s) => s.setLightboxImages);
  const batches = useStore((s) => s.batches);
  const addImageToBatch = useStore((s) => s.addImageToBatch);
  const toggleRef = useStore((s) => s.toggleRef);
  const selectedRefs = useStore((s) => s.selectedRefs);
  const assessments = useStore((s) => s.assessments);
  const addToast = useStore((s) => s.addToast);
  const setPrompt = useStore((s) => s.setPrompt);
  const setRefs = useStore((s) => s.setRefs);

  const [showBatchMenu, setShowBatchMenu] = useState(false);
  const [showAssessmentPanel, setShowAssessmentPanel] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Touch gesture state for swipe navigation
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const generatedImages = useStore((s) => s.generatedImages);
  const setGeneratedImages = useStore((s) => s.setGeneratedImages);
  const library = useStore((s) => s.library);
  const setLibrary = useStore((s) => s.setLibrary);

  const { isOpen, images, currentIndex } = lightbox;
  const currentImage = images[currentIndex];
  const assessment = currentImage ? assessments[currentImage.file] : undefined;

  const goNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setLightboxIndex(currentIndex + 1);
    }
  }, [currentIndex, images.length, setLightboxIndex]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setLightboxIndex(currentIndex - 1);
    }
  }, [currentIndex, setLightboxIndex]);

  // Touch gesture handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Only trigger if horizontal swipe is dominant and significant (> 50px)
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX > 0) {
        goPrev();
      } else {
        goNext();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle delete confirmation dialog
      if (showDeleteConfirm) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleDelete();
        } else if (e.key === 'Escape') {
          setShowDeleteConfirm(false);
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          closeLightbox();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
        case 'ArrowRight':
          goNext();
          break;
        case 'r':
        case 'R':
          if (currentImage) {
            toggleRef(currentImage.file);
            addToast({
              message: selectedRefs.includes(currentImage.file)
                ? 'Removed from references'
                : 'Added as reference',
              type: 'success',
            });
          }
          break;
        case 'd':
        case 'D':
          if (currentImage) handleDownload();
          break;
        case 'b':
        case 'B':
          setShowBatchMenu(true);
          break;
        case 'a':
        case 'A':
          if (currentImage) setShowAssessmentPanel(!showAssessmentPanel);
          break;
        case 'e':
        case 'E':
          if (currentImage && !showEditor) setShowEditor(true);
          break;
        case 's':
        case 'S':
          if (currentImage && !showScheduleModal) setShowScheduleModal(true);
          break;
        case 'Backspace':
        case 'Delete':
          if (currentImage && !showDeleteConfirm) setShowDeleteConfirm(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentImage, goNext, goPrev, closeLightbox, toggleRef, selectedRefs, addToast, showEditor, showDeleteConfirm, showAssessmentPanel, showScheduleModal]);

  const handleDownload = async () => {
    if (!currentImage) return;
    try {
      const url = getImageUrl(currentImage.file);
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = currentImage.file.split('/').pop() || 'image.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      addToast({ message: 'Image downloaded', type: 'success' });
    } catch (e) {
      addToast({ message: 'Failed to download', type: 'error' });
    }
  };

  const handleAddToBatch = (batchId: string) => {
    if (!currentImage) return;
    addImageToBatch(batchId, currentImage.file);
    setShowBatchMenu(false);
    const batch = batches.find((b) => b.id === batchId);
    addToast({ message: `Added to ${batch?.name}`, type: 'success' });
  };

  const handleRetryWithFix = (fix: string) => {
    if (!currentImage) return;
    // Set the current image as reference and the fix as prompt
    setRefs([currentImage.file]);
    setPrompt(fix);
    closeLightbox();
    addToast({ message: 'Ready to generate with fix', type: 'info' });
  };

  // Find which batch (if any) the current image belongs to
  const findImageBatch = (file: string) => {
    for (const batch of batches) {
      if (batch.images.some(img => img.file === file)) {
        return batch.id;
      }
    }
    return null;
  };

  const handleSaveEdited = async (editedDataUrl: string) => {
    if (!currentImage) return;
    try {
      const result = await saveImage({
        image: editedDataUrl,
        prompt: currentImage.prompt || 'edited',
        model: 'edited',
      });

      // Add to same batch if original was in a batch
      const batchId = findImageBatch(currentImage.file);
      if (batchId && result.filename) {
        const newFilePath = `to-be-processed/${result.filename}`;
        addImageToBatch(batchId, newFilePath);
      }

      setShowEditor(false);
      addToast({ message: 'Edited image saved' + (batchId ? ' to batch' : ''), type: 'success' });
    } catch (e) {
      addToast({ message: 'Failed to save edited image', type: 'error' });
    }
  };

  const handleGridSave = async (images: { dataUrl: string; index: number }[]) => {
    if (!currentImage) return;
    try {
      // Extract base filename without extension
      const fileName = currentImage.file.split('/').pop() || 'image.png';
      const baseName = fileName.replace(/\.[^/.]+$/, '');

      // Find batch before saving
      const batchId = findImageBatch(currentImage.file);

      // Save all cropped images
      for (const img of images) {
        const result = await saveGridImage({
          image: img.dataUrl,
          base_filename: baseName,
          index: img.index,
        });

        // Add to same batch if original was in a batch
        if (batchId && result.filename) {
          const newFilePath = `to-be-processed/${result.filename}`;
          addImageToBatch(batchId, newFilePath);
        }
      }

      setShowEditor(false);
      addToast({ message: `Saved ${images.length} images` + (batchId ? ' to batch' : ''), type: 'success' });
    } catch (e) {
      addToast({ message: 'Failed to save grid images', type: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!currentImage || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteImage(currentImage.file);

      // Remove from generated images if present
      setGeneratedImages(generatedImages.filter((img) => img.file !== currentImage.file));

      // Remove from library if present
      setLibrary(library.filter((img) => img.file !== currentImage.file));

      // Update lightbox images and navigate
      const newImages = images.filter((img) => img.file !== currentImage.file);

      if (newImages.length === 0) {
        // No more images, close lightbox
        closeLightbox();
      } else {
        // Update the images array first
        setLightboxImages(newImages);

        // Adjust index if needed (if we deleted the last image, go to previous)
        if (currentIndex >= newImages.length) {
          setLightboxIndex(newImages.length - 1);
        }
        // If not at the end, index stays the same (effectively showing "next" image)
      }

      setShowDeleteConfirm(false);
      addToast({ message: 'Moved to archive', type: 'success' });
    } catch (e) {
      addToast({ message: 'Failed to archive image', type: 'error' });
    }
    setIsDeleting(false);
  };

  // Assessment score color
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-ok';
    if (score >= 6) return 'text-gold';
    if (score >= 4) return 'text-amber';
    return 'text-err';
  };

  const getScoreBg = (score: number) => {
    if (score >= 8) return 'bg-ok-dim border-ok/30';
    if (score >= 6) return 'bg-gold-dim border-gold/30';
    if (score >= 4) return 'bg-amber-dim border-amber/30';
    return 'bg-err-dim border-err/30';
  };

  if (!isOpen || !currentImage) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-void/95 backdrop-blur-sm flex flex-col"
        onClick={closeLightbox}
      >
        {/* Header - responsive padding and touch targets */}
        <div
          className="shrink-0 h-14 flex items-center justify-between px-3 md:px-6 border-b border-border/50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 md:gap-4">
            <span className="text-sm text-text-2">
              {currentIndex + 1} / {images.length}
            </span>
            {currentImage.model && (
              <span className="text-xs text-text-3 px-2 py-0.5 rounded bg-bg-3 hidden sm:inline">
                {currentImage.model}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            {/* Download button - 44px touch target */}
            <button
              onClick={handleDownload}
              className="p-3 md:p-2 rounded-lg hover:bg-bg-3 text-text-2 hover:text-text transition-colors
                       min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Download (D)"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            {/* Close button - 44px touch target */}
            <button
              onClick={closeLightbox}
              className="p-3 md:p-2 rounded-lg hover:bg-bg-3 text-text-2 hover:text-text transition-colors
                       min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main content area with optional side panel */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Image area with swipe support */}
          <div
            ref={imageContainerRef}
            className="flex-1 min-h-0 flex items-center justify-center p-4 md:p-8 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
          {/* Navigation arrows - hidden on mobile (use swipe), visible on tablet+ */}
          {currentIndex > 0 && (
            <button
              onClick={goPrev}
              className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full
                       bg-bg-3/80 hover:bg-bg-4 text-text-2 hover:text-text transition-all
                       backdrop-blur-sm items-center justify-center
                       min-w-[48px] min-h-[48px]"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {currentIndex < images.length - 1 && (
            <button
              onClick={goNext}
              className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full
                       bg-bg-3/80 hover:bg-bg-4 text-text-2 hover:text-text transition-all
                       backdrop-blur-sm items-center justify-center
                       min-w-[48px] min-h-[48px]"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Swipe hint for mobile */}
          <div className="md:hidden absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-text-3 opacity-50">
            Swipe to navigate
          </div>

          {/* Main image */}
          <motion.img
            key={currentImage.file}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            src={getImageUrl(currentImage.file)}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          </div>

          {/* Assessment Panel */}
          <AnimatePresence>
            {showAssessmentPanel && (
              <AssessmentPanel
                file={currentImage.file}
                prompt={currentImage.prompt}
                onClose={() => setShowAssessmentPanel(false)}
                onApplyFix={handleRetryWithFix}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Footer with actions - scrollable on mobile, centered on desktop */}
        <div
          className="shrink-0 min-h-[72px] md:h-20 border-t border-border/50 flex items-center justify-start md:justify-center
                     gap-2 md:gap-3 px-3 md:px-6 overflow-x-auto scrollbar-none
                     pb-[env(safe-area-inset-bottom)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Use as reference - icon only on mobile */}
          <Button
            variant={selectedRefs.includes(currentImage.file) ? 'primary' : 'secondary'}
            size="md"
            className="shrink-0 min-w-[44px] min-h-[44px]"
            onClick={() => {
              toggleRef(currentImage.file);
              addToast({
                message: selectedRefs.includes(currentImage.file)
                  ? 'Removed from references'
                  : 'Added as reference',
                type: 'success',
              });
            }}
          >
            <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">
              {selectedRefs.includes(currentImage.file) ? 'Selected' : 'Ref'}
            </span>
            <span className="hidden md:inline text-xs opacity-60">R</span>
          </Button>

          {/* Add to batch - icon only on mobile */}
          <div className="relative shrink-0">
            <Button variant="secondary" size="md" className="min-w-[44px] min-h-[44px]" onClick={() => setShowBatchMenu(!showBatchMenu)}>
              <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="hidden sm:inline">Batch</span>
              <span className="hidden md:inline text-xs opacity-60">B</span>
            </Button>

            <AnimatePresence>
              {showBatchMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-full mb-2 left-0 min-w-[200px]
                           bg-bg-3 border border-border rounded-lg shadow-xl overflow-hidden"
                >
                  {batches.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-text-3">No collections yet</p>
                  ) : (
                    batches.map((batch) => {
                      const isInBatch = currentImage && batch.images.some((img) => img.file === currentImage.file);
                      return (
                        <button
                          key={batch.id}
                          onClick={() => handleAddToBatch(batch.id)}
                          className={cn(
                            "w-full px-4 py-3 md:py-2.5 flex items-center gap-2 text-left",
                            "text-sm transition-colors min-h-[44px]",
                            isInBatch
                              ? "bg-gold-dim text-gold"
                              : "text-text hover:bg-bg-4"
                          )}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: batch.color }}
                          />
                          <span className="truncate flex-1">{batch.name}</span>
                          {isInBatch ? (
                            <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="text-xs text-text-3">{batch.images.length}</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Schedule - icon only on mobile */}
          <Button variant="secondary" size="md" className="shrink-0 min-w-[44px] min-h-[44px]" onClick={() => setShowScheduleModal(true)}>
            <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">Schedule</span>
            <span className="hidden md:inline text-xs opacity-60">S</span>
          </Button>

          {/* Edit - icon only on mobile */}
          <Button variant="secondary" size="md" className="shrink-0 min-w-[44px] min-h-[44px]" onClick={() => setShowEditor(true)}>
            <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="hidden sm:inline">Edit</span>
            <span className="hidden md:inline text-xs opacity-60">E</span>
          </Button>

          {/* Delete - icon only on mobile */}
          <div className="relative shrink-0">
            <Button
              variant="secondary"
              size="md"
              className="min-w-[44px] min-h-[44px] hover:!bg-err-dim hover:!text-err hover:!border-err/30"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </Button>

            {/* Delete confirmation modal */}
            <AnimatePresence>
              {showDeleteConfirm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[300] flex items-center justify-center bg-void/80 backdrop-blur-sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-bg-2 border border-border rounded-xl shadow-2xl overflow-hidden max-w-sm w-full mx-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header with icon */}
                    <div className="px-5 pt-5 pb-4 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-err-dim flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-err" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-medium text-text mb-1">Delete image?</h3>
                        <p className="text-sm text-text-3">This action cannot be undone.</p>
                      </div>
                    </div>

                    {/* Image preview */}
                    <div className="px-5 pb-4">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-3 border border-border">
                        <img
                          src={getImageUrl(currentImage.file)}
                          alt=""
                          className="w-12 h-12 rounded object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text truncate">
                            {currentImage.file.split('/').pop()}
                          </p>
                          {currentImage.prompt && (
                            <p className="text-xs text-text-3 truncate mt-0.5">
                              {currentImage.prompt}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="px-5 pb-5 flex gap-3">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 px-4 py-2.5 rounded-lg bg-bg-3 border border-border text-text text-sm font-medium
                                 hover:bg-bg-4 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-2.5 rounded-lg bg-err text-white text-sm font-medium
                                 hover:bg-err/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isDeleting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Assessment toggle button - icon only on mobile */}
          {assessment ? (
            <button
              onClick={() => setShowAssessmentPanel(!showAssessmentPanel)}
              className={cn(
                'px-3 md:px-4 py-2 rounded-lg border flex items-center gap-2 transition-all shrink-0',
                'min-w-[44px] min-h-[44px]',
                getScoreBg(assessment.score),
                showAssessmentPanel && 'ring-2 ring-gold/50',
                'hover:scale-105'
              )}
            >
              <span className={cn('text-base md:text-lg font-bold', getScoreColor(assessment.score))}>
                {assessment.score}/10
              </span>
              <span className="hidden md:inline text-xs opacity-60">A</span>
            </button>
          ) : (
            <Button
              variant={showAssessmentPanel ? 'primary' : 'secondary'}
              size="md"
              className="shrink-0 min-w-[44px] min-h-[44px]"
              onClick={() => setShowAssessmentPanel(!showAssessmentPanel)}
            >
              <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden sm:inline">Assess</span>
              <span className="hidden md:inline text-xs opacity-60">A</span>
            </Button>
          )}
        </div>

        {/* Prompt display - hidden on very small screens to save space */}
        {currentImage.prompt && (
          <div className="hidden sm:block px-4 md:px-6 pb-4 text-center">
            <p className="text-xs md:text-sm text-text-2 max-w-2xl mx-auto line-clamp-2">
              {currentImage.prompt}
            </p>
          </div>
        )}

        {/* Image Editor */}
        <AnimatePresence>
          {showEditor && (
            <ImageEditor
              imageUrl={getImageUrl(currentImage.file)}
              onSave={handleSaveEdited}
              onCancel={() => setShowEditor(false)}
              onGridSave={handleGridSave}
            />
          )}
        </AnimatePresence>

        {/* Schedule Modal */}
        <AnimatePresence>
          {showScheduleModal && (
            <ScheduleModal
              file={currentImage.file}
              prompt={currentImage.prompt}
              onClose={() => setShowScheduleModal(false)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
