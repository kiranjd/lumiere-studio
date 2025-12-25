import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../stores/store';
import { ImageCard } from '../cards/ImageCard';
import { fetchLibrary, updateImageTag } from '../../api/server';
import { cn } from '../../utils/cn';

export function LibraryView() {
  const library = useStore((s) => s.library);
  const setLibrary = useStore((s) => s.setLibrary);
  const libraryLoading = useStore((s) => s.libraryLoading);
  const setLibraryLoading = useStore((s) => s.setLibraryLoading);
  const libraryFilter = useStore((s) => s.libraryFilter);
  const setLibraryFilter = useStore((s) => s.setLibraryFilter);
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

  // Define tag groups for organization
  const TAG_GROUPS: Record<string, string[]> = {
    'Type': ['generated', 'reference', 'specific', 'expression', 'grid', 'expressions', 'library', 'ipad'],
    'Outfit': ['outfit', 'casual', 'dress', 'formal', 'saree'],
    'Style': ['artistic', 'candid', 'phone', 'mirror', 'selfie', 'portrait', 'intimate'],
    'Model': ['gpt', 'gemini', 'misc'],
  };

  // Get unique tags from library, grouped
  const groupedTags = useMemo(() => {
    const tagCounts = new Map<string, number>();
    library.forEach((img) => img.tags?.forEach((t) => {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }));

    const groups: Record<string, Array<{ tag: string; count: number }>> = {};
    const expressionTags: Array<{ tag: string; count: number }> = [];
    const ungrouped: Array<{ tag: string; count: number }> = [];

    // Known expression tags
    const EXPRESSIONS = new Set([
      'happy', 'sad', 'angry', 'neutral', 'disgusted', 'shocked', 'confused',
      'content', 'laughing', 'pleasant', 'pouting', 'smiling', 'surprised',
      'thinking', 'upset', 'winking', 'worried'
    ]);

    tagCounts.forEach((count, tag) => {
      // Check if it's an expression
      if (EXPRESSIONS.has(tag)) {
        expressionTags.push({ tag, count });
        return;
      }

      // Check which group it belongs to
      let found = false;
      for (const [group, tags] of Object.entries(TAG_GROUPS)) {
        if (tags.includes(tag)) {
          if (!groups[group]) groups[group] = [];
          groups[group].push({ tag, count });
          found = true;
          break;
        }
      }

      if (!found) {
        ungrouped.push({ tag, count });
      }
    });

    // Sort each group alphabetically
    Object.values(groups).forEach((g) => g.sort((a, b) => a.tag.localeCompare(b.tag)));
    expressionTags.sort((a, b) => a.tag.localeCompare(b.tag));
    ungrouped.sort((a, b) => a.tag.localeCompare(b.tag));

    return { groups, expressionTags, ungrouped };
  }, [library]);

  // Filter and sort library (newest first based on filename patterns)
  const filteredLibrary = useMemo(() => {
    let filtered = libraryFilter
      ? library.filter((img) => img.tags?.includes(libraryFilter))
      : library;

    // Sort newest first: IMG_ files by number, dated files by date, others alphabetically
    return [...filtered].sort((a, b) => {
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
  }, [library, libraryFilter]);

  const handleOpenLightbox = useCallback((index: number) => {
    const images = filteredLibrary.map((img) => ({
      file: img.file,
      prompt: img.prompt,
      model: img.model,
    }));
    openLightbox(images, index, 'library');
  }, [filteredLibrary, openLightbox]);

  // Keyboard navigation: arrows to move, Space to toggle ref, Enter to open
  useEffect(() => {
    // Don't handle keys if lightbox is open
    if (lightbox.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const len = filteredLibrary.length;
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
            toggleRef(filteredLibrary[focusedIndex].file);
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
  }, [filteredLibrary, focusedIndex, lightbox.isOpen, toggleRef, handleOpenLightbox]);

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
      {/* Filter bar - simplified */}
      {library.length > 0 && (
        <FilterBar
          library={library}
          libraryFilter={libraryFilter}
          setLibraryFilter={setLibraryFilter}
          groupedTags={groupedTags}
          onRefreshLibrary={async () => {
            const images = await fetchLibrary();
            setLibrary(images);
          }}
        />
      )}

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
          {filteredLibrary.map((img, index) => (
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

// Simplified filter bar component
function FilterBar({
  library,
  libraryFilter,
  setLibraryFilter,
  groupedTags,
  onRefreshLibrary,
}: {
  library: any[];
  libraryFilter: string;
  setLibraryFilter: (filter: string) => void;
  groupedTags: {
    groups: Record<string, Array<{ tag: string; count: number }>>;
    expressionTags: Array<{ tag: string; count: number }>;
    ungrouped: Array<{ tag: string; count: number }>;
  };
  onRefreshLibrary: () => void;
}) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dragOverTag, setDragOverTag] = useState<string | null>(null);
  const addToast = useStore((s) => s.addToast);

  // Primary filters (most used)
  const primaryFilters = [
    { tag: 'reference', label: 'References' },
    { tag: 'generated', label: 'Generated' },
    { tag: 'ipad', label: 'iPad' },
    { tag: 'specific', label: 'Expressions' },
  ];

  // Get count for a tag
  const getCount = (tag: string) => {
    return library.filter((img) => img.tags?.includes(tag)).length;
  };

  // Drag handlers for tag buttons
  const handleDragOver = (e: React.DragEvent, tag: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverTag(tag);
  };

  const handleDragLeave = () => {
    setDragOverTag(null);
  };

  const handleDrop = async (e: React.DragEvent, tag: string) => {
    e.preventDefault();
    setDragOverTag(null);
    const data = e.dataTransfer.getData('text/plain');
    if (data) {
      // Try to parse as JSON array, fallback to single file
      let files: string[];
      try {
        const parsed = JSON.parse(data);
        files = Array.isArray(parsed) ? parsed : [data];
      } catch {
        files = [data];
      }

      try {
        await Promise.all(files.map(file => updateImageTag(file, tag, 'add')));
        addToast({
          message: files.length > 1 ? `Tagged ${files.length} images as "${tag}"` : `Tagged as "${tag}"`,
          type: 'success'
        });
        onRefreshLibrary();
      } catch (error) {
        addToast({ message: 'Failed to add tag', type: 'error' });
      }
    }
  };

  return (
    <div className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 border-b border-border
                    flex items-center gap-1.5 sm:gap-2 overflow-x-auto
                    scrollbar-none touch-pan-x">
      {/* All button */}
      <button
        onClick={() => setLibraryFilter('')}
        className={cn(
          'px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0',
          'min-h-[36px] sm:min-h-[auto]', // Touch-friendly height on mobile
          !libraryFilter
            ? 'bg-gold text-void'
            : 'bg-bg-3 text-text-2 hover:bg-bg-4 active:bg-bg-4'
        )}
      >
        All ({library.length})
      </button>

      <div className="w-px h-5 bg-border shrink-0" />

      {/* Primary quick filters - droppable */}
      {primaryFilters.map(({ tag, label }) => {
        const count = getCount(tag);
        if (count === 0) return null;
        return (
          <button
            key={tag}
            onClick={() => setLibraryFilter(tag === libraryFilter ? '' : tag)}
            onDragOver={(e) => handleDragOver(e, tag)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, tag)}
            className={cn(
              'px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0',
              'min-h-[36px] sm:min-h-[auto]',
              tag === libraryFilter
                ? 'bg-gold text-void'
                : 'bg-bg-3 text-text-2 hover:bg-bg-4 active:bg-bg-4',
              dragOverTag === tag && 'ring-2 ring-gold bg-gold/20 scale-105'
            )}
          >
            {label} ({count})
          </button>
        );
      })}

      <div className="w-px h-5 bg-border shrink-0 hidden sm:block" />

      {/* Category dropdowns - hidden on mobile */}
      {Object.entries(groupedTags.groups).map(([groupName, tags]) => {
        if (tags.length === 0) return null;
        const isOpen = activeDropdown === groupName;
        const hasActiveFilter = tags.some((t) => t.tag === libraryFilter);

        return (
          <div key={groupName} className="relative hidden sm:block">
            <button
              onClick={() => setActiveDropdown(isOpen ? null : groupName)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5',
                hasActiveFilter
                  ? 'bg-gold text-void'
                  : 'bg-bg-3 text-text-2 hover:bg-bg-4'
              )}
            >
              {groupName}
              {hasActiveFilter && `: ${libraryFilter}`}
              <svg className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full left-0 mt-1 z-50 min-w-[140px]
                           bg-bg-3 border border-border rounded-lg shadow-xl overflow-hidden"
                >
                  {tags.map(({ tag, count }) => (
                    <button
                      key={tag}
                      onClick={() => {
                        setLibraryFilter(tag === libraryFilter ? '' : tag);
                        setActiveDropdown(null);
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-3',
                        'transition-colors',
                        tag === libraryFilter
                          ? 'bg-gold text-void'
                          : 'text-text-2 hover:bg-bg-4'
                      )}
                    >
                      <span className="capitalize">{tag}</span>
                      <span className="text-xs opacity-60">{count}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Expression dropdown - hidden on mobile */}
      {groupedTags.expressionTags.length > 0 && (
        <div className="relative hidden sm:block">
          <button
            onClick={() => setActiveDropdown(activeDropdown === 'expressions' ? null : 'expressions')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5',
              groupedTags.expressionTags.some((t) => t.tag === libraryFilter)
                ? 'bg-purple text-void'
                : 'bg-bg-3 text-text-2 hover:bg-bg-4'
            )}
          >
            Mood
            {groupedTags.expressionTags.some((t) => t.tag === libraryFilter) && `: ${libraryFilter}`}
            <svg className={cn('w-3 h-3 transition-transform', activeDropdown === 'expressions' && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <AnimatePresence>
            {activeDropdown === 'expressions' && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute top-full left-0 mt-1 z-50 min-w-[140px] max-h-[300px] overflow-y-auto
                         bg-bg-3 border border-border rounded-lg shadow-xl"
              >
                {groupedTags.expressionTags.map(({ tag }) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setLibraryFilter(tag === libraryFilter ? '' : tag);
                      setActiveDropdown(null);
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm',
                      'transition-colors capitalize',
                      tag === libraryFilter
                        ? 'bg-purple text-void'
                        : 'text-text-2 hover:bg-bg-4'
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Clear filter if active */}
      {libraryFilter && (
        <button
          onClick={() => setLibraryFilter('')}
          className="ml-auto p-1.5 rounded hover:bg-bg-3 text-text-3 hover:text-text transition-colors"
          title="Clear filter"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
