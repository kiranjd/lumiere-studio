import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../../stores/store';
import { ImageCard } from '../cards/ImageCard';
import { fetchLibrary } from '../../api/server';
import { cn } from '../../utils/cn';

export function LibraryView() {
  const library = useStore((s) => s.library);
  const setLibrary = useStore((s) => s.setLibrary);
  const libraryLoading = useStore((s) => s.libraryLoading);
  const setLibraryLoading = useStore((s) => s.setLibraryLoading);
  const openLightbox = useStore((s) => s.openLightbox);
  const selectedRefs = useStore((s) => s.selectedRefs);
  const toggleRef = useStore((s) => s.toggleRef);
  const compareImages = useStore((s) => s.compareImages);
  const toggleCompare = useStore((s) => s.toggleCompare);
  const assessments = useStore((s) => s.assessments);
  const lightbox = useStore((s) => s.lightbox);

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Load library on mount
  useEffect(() => {
    const load = async () => {
      setLibraryLoading(true);
      try {
        const images = await fetchLibrary();
        setLibrary(images);
      } catch (e) {
        console.error('Failed to load library:', e);
      }
      setLibraryLoading(false);
    };
    load();
  }, []);

  // Sort library (newest first based on filename patterns)
  const sortedLibrary = useMemo(() => {
    // Sort newest first: IMG_ files by number, dated files by date, others alphabetically
    return [...library].sort((a, b) => {
      const aFile = a.file;
      const bFile = b.file;

      // IMG_ files (iPad): sort by number descending
      const aImgMatch = aFile.match(/IMG_(\d+)/);
      const bImgMatch = bFile.match(/IMG_(\d+)/);
      if (aImgMatch && bImgMatch) {
        return parseInt(bImgMatch[1]) - parseInt(aImgMatch[1]);
      }

      // Dated files (2025...): sort by date descending
      const aDateMatch = aFile.match(/^(\d{8}_\d{6})/);
      const bDateMatch = bFile.match(/^(\d{8}_\d{6})/);
      if (aDateMatch && bDateMatch) {
        return bDateMatch[1].localeCompare(aDateMatch[1]);
      }

      // IMG_ files come before dated files
      if (aImgMatch && !bImgMatch) return -1;
      if (!aImgMatch && bImgMatch) return 1;

      // Dated files come before other files
      if (aDateMatch && !bDateMatch) return -1;
      if (!aDateMatch && bDateMatch) return 1;

      // Everything else alphabetically
      return aFile.localeCompare(bFile);
    });
  }, [library]);

  const handleOpenLightbox = useCallback((index: number) => {
    const images = sortedLibrary.map((img) => ({
      file: img.file,
      prompt: img.prompt,
      model: img.model,
    }));
    openLightbox(images, index, 'library');
  }, [sortedLibrary, openLightbox]);

  // Keyboard navigation: arrows to move, Space to toggle ref, Enter to open
  useEffect(() => {
    // Don't handle keys if lightbox is open
    if (lightbox.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const len = sortedLibrary.length;
      if (len === 0) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          setFocusedIndex((prev) => (prev < 0 ? 0 : Math.min(prev + 1, len - 1)));
          break;
        case 'ArrowLeft':
        case 'h':
          e.preventDefault();
          setFocusedIndex((prev) => (prev < 0 ? 0 : Math.max(prev - 1, 0)));
          break;
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          // Move down ~4 items (approximate row)
          setFocusedIndex((prev) => (prev < 0 ? 0 : Math.min(prev + 4, len - 1)));
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          setFocusedIndex((prev) => (prev < 0 ? 0 : Math.max(prev - 4, 0)));
          break;
        case ' ':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < len) {
            toggleRef(sortedLibrary[focusedIndex].file);
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < len) {
            handleOpenLightbox(focusedIndex);
          }
          break;
        case 'Escape':
          setFocusedIndex(-1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortedLibrary, focusedIndex, lightbox.isOpen, toggleRef, handleOpenLightbox]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0) {
      const el = document.querySelector(`[data-library-index="${focusedIndex}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusedIndex]);

  if (libraryLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-3 text-sm">Loading library...</p>
        </div>
      </div>
    );
  }

  if (library.length === 0) {
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
          <h3 className="text-lg font-medium text-text mb-2">Library is empty</h3>
          <p className="text-text-3 text-sm">
            Add reference images to your library to use them for generation.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Selected refs indicator */}
      {selectedRefs.length > 0 && (
        <div className="px-6 py-2 bg-gold-dim border-b border-gold/20 flex items-center justify-between">
          <span className="text-sm text-gold">
            {selectedRefs.length} reference{selectedRefs.length !== 1 ? 's' : ''} selected
            {selectedRefs.length >= 4 && ' (max)'}
          </span>
          <button
            onClick={() => useStore.getState().clearRefs()}
            className="text-xs text-gold hover:text-gold-bright transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Image grid - responsive CSS columns masonry */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-32">
        <div className="masonry-grid">
          {sortedLibrary.map((img, index) => (
            <div
              key={img.file}
              data-library-index={index}
              className={cn(
                'rounded-lg transition-all',
                focusedIndex === index && 'ring-2 ring-gold ring-offset-2 ring-offset-bg-1'
              )}
              style={{
                // Limit stagger animation to first 20 items for performance
                animation: index < 20
                  ? `scale-in 0.3s ease-out ${Math.min(index * 0.02, 0.3)}s backwards`
                  : undefined,
                // Use content-visibility for performance on large lists
                contentVisibility: index > 30 ? 'auto' : undefined,
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
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
