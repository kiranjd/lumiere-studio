import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../stores/store';
import { cn } from '../../utils/cn';
import { MODELS, ASPECT_RATIOS, QUALITY_SETTINGS } from '../../utils/constants';
import { getImageUrl } from '../../api/server';
import { processQueueItem, saveGeneratedImage } from '../../api/generation';
import { fetchGeneratedImages } from '../../api/server';
import type { QueueItem } from '../../types';

export function GeneratorIsland() {
  const prompt = useStore((s) => s.prompt);
  const setPrompt = useStore((s) => s.setPrompt);
  const selectedRefs = useStore((s) => s.selectedRefs);
  const clearRefs = useStore((s) => s.clearRefs);
  const toggleRef = useStore((s) => s.toggleRef);
  const selectedModels = useStore((s) => s.selectedModels);
  const toggleModel = useStore((s) => s.toggleModel);
  const aspect = useStore((s) => s.aspect);
  const setAspect = useStore((s) => s.setAspect);
  const quality = useStore((s) => s.quality);
  const setQuality = useStore((s) => s.setQuality);
  const quantity = useStore((s) => s.quantity);
  const setQuantity = useStore((s) => s.setQuantity);
  const addToQueue = useStore((s) => s.addToQueue);
  const updateQueueItem = useStore((s) => s.updateQueueItem);
  const activeGenerations = useStore((s) => s.activeGenerations);
  const incrementGenerations = useStore((s) => s.incrementGenerations);
  const decrementGenerations = useStore((s) => s.decrementGenerations);
  const addToHistory = useStore((s) => s.addToHistory);
  const promptHistory = useStore((s) => s.promptHistory);
  const setView = useStore((s) => s.setView);
  const addToast = useStore((s) => s.addToast);
  const setGeneratedImages = useStore((s) => s.setGeneratedImages);

  const promptTemplates = useStore((s) => s.promptTemplates);

  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle drag and drop for references
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only set false if leaving the container entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
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

      let added = 0;
      for (const file of files) {
        if (selectedRefs.length + added >= 4) {
          addToast({ message: 'Maximum 4 references allowed', type: 'error' });
          break;
        }
        if (!selectedRefs.includes(file)) {
          toggleRef(file);
          added++;
        }
      }
      if (added > 0) {
        addToast({
          message: added > 1 ? `Added ${added} references` : 'Added as reference',
          type: 'success'
        });
      }
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [prompt]);

  // Keyboard shortcut: Cmd+Enter to generate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGenerate();
      }
      // Escape to collapse
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prompt, selectedModels, selectedRefs, isExpanded]);

  // Click outside to collapse (but keep text)
  const islandRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isExpanded && islandRef.current && !islandRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      addToast({ message: 'Enter a prompt', type: 'error' });
      return;
    }
    if (selectedModels.length === 0) {
      addToast({ message: 'Select at least one model', type: 'error' });
      return;
    }

    // Save prompt to history
    addToHistory(prompt.trim());

    // Create queue items for each selected model × quantity
    const items: QueueItem[] = selectedModels.flatMap((modelId) =>
      Array.from({ length: quantity }, (_, i) => ({
        id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${i}`,
        prompt: prompt.trim(),
        model: modelId,
        refs: [...selectedRefs],
        aspect,
        quality,
        status: 'pending' as const,
        createdAt: Date.now(),
      }))
    );

    console.log('[Generate] Creating items:', { quantity, selectedModels: selectedModels.length, totalItems: items.length, items });

    // Add to queue and switch to queue view
    addToQueue(items);
    setView('queue');
    setPrompt('');
    setIsExpanded(false);

    // Track active generations
    incrementGenerations(items.length);

    // Update all to processing
    items.forEach((item) => {
      updateQueueItem(item.id, { status: 'processing' });
    });

    // Process in parallel - each item decrements when done
    items.forEach(async (item) => {
      try {
        const imageUrl = await processQueueItem(item);
        updateQueueItem(item.id, { status: 'done', imageUrl, completedAt: Date.now() });

        // Save to server with full metadata
        await saveGeneratedImage({
          imageUrl,
          prompt: item.prompt,
          model: item.model,
          refs: item.refs,
          aspect: item.aspect,
          quality: item.quality,
        });

        // Refresh generated list
        const images = await fetchGeneratedImages();
        setGeneratedImages(images);

        // Play success sound
        playChime();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generation failed';
        updateQueueItem(item.id, { status: 'error', error: message });
        addToast({ message, type: 'error' });
      } finally {
        decrementGenerations(1);
      }
    });
  };

  const handleSelectFromHistory = (historyPrompt: string) => {
    setPrompt(historyPrompt);
    setShowHistory(false);
    textareaRef.current?.focus();
  };

  const handleSelectTemplate = (templatePrompt: string) => {
    setPrompt(templatePrompt);
    textareaRef.current?.focus();
  };

  return (
    <motion.div
      ref={islandRef}
      layout
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'fixed z-50',
        // Mobile: full width with margins, safe area for home indicator
        'bottom-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2',
        // Tablet/Desktop: centered with fixed widths
        'md:bottom-5 lg:bottom-6',
        isExpanded
          ? 'md:w-[520px] lg:w-[580px]'
          : 'md:w-[440px] lg:w-[500px]',
        'bg-bg-2/95 backdrop-blur-xl border border-border rounded-2xl',
        'shadow-[0_0_60px_rgba(0,0,0,0.5)]',
        'transition-all duration-300',
        // Safe area for iOS home indicator
        'pb-[env(safe-area-inset-bottom)]',
        isDragOver && 'ring-2 ring-gold border-gold shadow-[0_0_30px_rgba(212,168,83,0.4)]'
      )}
    >
      {/* Reference thumbnails or drop zone */}
      <AnimatePresence>
        {(selectedRefs.length > 0 || isDragOver) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={cn(
              'px-4 py-2.5 border-b border-border/50',
              isDragOver && 'bg-gold/5'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-[11px] uppercase tracking-wider text-text-3 font-medium shrink-0">Refs</span>
              <div className="flex gap-2 flex-1 overflow-x-auto items-center">
                {selectedRefs.map((file, i) => (
                  <div
                    key={file}
                    className="relative w-11 h-11 md:w-10 md:h-10 lg:w-9 lg:h-9 rounded-lg overflow-hidden shrink-0 group
                               ring-2 ring-gold/40 shadow-sm"
                  >
                    <img
                      src={getImageUrl(file)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => useStore.getState().toggleRef(file)}
                      className="absolute inset-0 bg-void/70 opacity-100 md:opacity-0 md:group-hover:opacity-100
                               flex items-center justify-center transition-opacity"
                    >
                      <svg className="w-4 h-4 md:w-3.5 md:h-3.5 text-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="absolute bottom-0.5 right-0.5 w-4 h-4 md:w-3.5 md:h-3.5 rounded-full bg-gold text-void text-[10px] md:text-[9px] font-bold flex items-center justify-center">
                      {i + 1}
                    </div>
                  </div>
                ))}
                {/* Drop hint when dragging */}
                {isDragOver && (
                  <div className="w-9 h-9 rounded-lg border-2 border-dashed border-gold/50 flex items-center justify-center bg-gold/5">
                    <svg className="w-3.5 h-3.5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                )}
                {/* Empty slots */}
                {!isDragOver && selectedRefs.length < 4 && selectedRefs.length > 0 && (
                  <div className="w-9 h-9 rounded-lg border border-dashed border-border flex items-center justify-center">
                    <span className="text-[10px] text-text-3">{4 - selectedRefs.length}</span>
                  </div>
                )}
              </div>
              {selectedRefs.length > 0 && (
                <button
                  onClick={clearRefs}
                  className="text-[11px] text-text-3 hover:text-err transition-colors shrink-0 px-2 py-1 rounded hover:bg-err/10"
                >
                  Clear
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main input area */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Prompt textarea */}
          <div className="flex-1 relative flex items-center">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={() => setIsExpanded(true)}
              onClick={() => setIsExpanded(true)}
              placeholder="Describe your image..."
              rows={1}
              className="w-full bg-transparent text-text placeholder-text-3 resize-none text-sm leading-normal
                       !border-0 !outline-none !ring-0 !shadow-none focus:!border-0 focus:!outline-none focus:!ring-0 focus-visible:!outline-none"
              style={{ minHeight: '20px' }}
            />
            {/* History button - touch-friendly */}
            {promptHistory.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={cn(
                  'ml-2 p-2.5 md:p-1.5 rounded-md text-text-3 hover:text-text hover:bg-bg-3 transition-colors shrink-0',
                  'min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center',
                  showHistory && 'text-gold bg-gold/10'
                )}
                title="Prompt history"
              >
                <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            )}
          </div>

          {/* Generate button - touch-friendly */}
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim()}
            className={cn(
              'px-4 py-2.5 md:py-2 rounded-xl font-medium text-sm transition-all shrink-0',
              'flex items-center gap-2 min-h-[44px] md:min-h-[36px]',
              prompt.trim()
                ? 'bg-gold text-void hover:bg-gold-bright active:scale-95 shadow-[0_0_20px_rgba(212,168,83,0.3)]'
                : 'bg-bg-4 text-text-3 cursor-not-allowed'
            )}
          >
            <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="hidden sm:inline">Generate</span>
            {activeGenerations > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-void/20 rounded text-xs">
                {activeGenerations}
              </span>
            )}
          </button>
        </div>

        {/* History dropdown */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-0 right-0 bottom-full mb-2 mx-3
                       bg-bg-3 border border-border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto"
            >
              {promptHistory.slice(0, 10).map((h, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectFromHistory(h)}
                  className="w-full px-3 py-2 text-left text-sm text-text-2 hover:bg-bg-4 hover:text-text
                           transition-colors truncate border-b border-border last:border-0"
                >
                  {h}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Expanded options - compact single row */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-border/50 bg-bg-3/30 overflow-hidden"
          >
            <div className="px-3 py-2 flex items-center gap-2">
              {/* Model toggles */}
              <div className="flex gap-1">
                {MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => toggleModel(model.id)}
                    title={model.name}
                    className={cn(
                      'px-2 h-7 rounded text-[10px] font-medium transition-all active:scale-95 whitespace-nowrap',
                      selectedModels.includes(model.id)
                        ? 'bg-gold text-void'
                        : 'bg-bg-4 text-text-3 hover:text-text'
                    )}
                  >
                    {model.name}
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-border/40" />

              {/* Quality - compact */}
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as typeof quality)}
                title="Quality"
                className="bg-bg-4 text-text text-[10px] pl-2 pr-1 py-1 rounded border-none outline-none focus:ring-0 w-[70px]"
              >
                {(Object.entries(QUALITY_SETTINGS) as [typeof quality, typeof QUALITY_SETTINGS[typeof quality]][]).map(([key, setting]) => (
                  <option key={key} value={key}>{setting.label}</option>
                ))}
              </select>

              {/* Aspect - compact */}
              <select
                value={aspect}
                onChange={(e) => setAspect(e.target.value as typeof aspect)}
                title="Aspect ratio"
                className="bg-bg-4 text-text text-[10px] pl-2 pr-1 py-1 rounded border-none outline-none focus:ring-0 w-[52px]"
              >
                {Object.entries(ASPECT_RATIOS).map(([key]) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>

              <div className="w-px h-5 bg-border/40" />

              {/* Quantity selector */}
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-text-3">×</span>
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  title="Number of images per model"
                  className="bg-bg-4 text-text text-[10px] pl-1.5 pr-0.5 py-1 rounded border-none outline-none focus:ring-0 w-[36px]"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Templates dropdown */}
              {promptTemplates.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      const template = promptTemplates.find(t => t.id === e.target.value);
                      if (template) handleSelectTemplate(template.prompt);
                    }
                  }}
                  className="bg-bg-4 text-text-3 text-[10px] pl-2 pr-1 py-1 rounded border-none outline-none focus:ring-0"
                >
                  <option value="">Templates</option>
                  {promptTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Success chime
function playChime() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.frequency.setValueAtTime(880, audioCtx.currentTime);
    o.frequency.setValueAtTime(1108, audioCtx.currentTime + 0.1);
    g.gain.setValueAtTime(0.3, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    o.start();
    o.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    // Ignore audio errors
  }
}
