import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../stores/store';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';

export function Sidebar() {
  const batches = useStore((s) => s.batches);
  const activeBatchId = useStore((s) => s.activeBatchId);
  const setActiveBatch = useStore((s) => s.setActiveBatch);
  const createBatch = useStore((s) => s.createBatch);
  const deleteBatch = useStore((s) => s.deleteBatch);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const incognitoMode = useStore((s) => s.incognitoMode);
  const setIncognitoMode = useStore((s) => s.setIncognitoMode);
  const incognitoImages = useStore((s) => s.incognitoImages);
  const viewingIncognitoCollection = useStore((s) => s.viewingIncognitoCollection);
  const setViewingIncognitoCollection = useStore((s) => s.setViewingIncognitoCollection);
  const setView = useStore((s) => s.setView);

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Triple-click detection for incognito toggle
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<number | null>(null);

  const handleLogoClick = () => {
    if (incognitoMode) {
      // Single click exits incognito mode
      setIncognitoMode(false);
      return;
    }

    // Triple-click detection to enter incognito
    clickCountRef.current += 1;

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    if (clickCountRef.current >= 3) {
      // Triple click - enter incognito mode
      setIncognitoMode(true);
      clickCountRef.current = 0;
    } else {
      // Reset after 400ms
      clickTimerRef.current = window.setTimeout(() => {
        clickCountRef.current = 0;
      }, 400);
    }
  };

  // Close sidebar on mobile when navigating
  const handleBatchClick = (batchId: string) => {
    setActiveBatch(batchId);
    setViewingIncognitoCollection(false);
    // Close on mobile after selection
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const handleCreate = () => {
    if (newName.trim()) {
      createBatch(newName.trim());
      setNewName('');
      setIsCreating(false);
    }
  };

  const handleDragOver = (e: React.DragEvent, batchId: string) => {
    e.preventDefault();
    setDragOverId(batchId);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, batchId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const data = e.dataTransfer.getData('text/plain');
    if (data) {
      let files: string[];
      try {
        const parsed = JSON.parse(data);
        files = Array.isArray(parsed) ? parsed : [data];
      } catch {
        files = [data];
      }

      files.forEach(file => {
        useStore.getState().addImageToBatch(batchId, file);
      });
      useStore.getState().addToast({
        message: files.length > 1 ? `Added ${files.length} images to collection` : 'Added to collection',
        type: 'success'
      });
    }
  };

  // Handle escape key to close sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen && window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, setSidebarOpen]);

  // Exit incognito mode when window loses focus or visibility
  useEffect(() => {
    if (!incognitoMode) return;

    const exitIncognito = () => {
      setIncognitoMode(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        exitIncognito();
      }
    };

    window.addEventListener('blur', exitIncognito);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', exitIncognito);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [incognitoMode, setIncognitoMode]);

  // Toggle button (shown when sidebar is closed OR on mobile)
  const ToggleButton = () => (
    <button
      onClick={() => setSidebarOpen(true)}
      className={cn(
        'fixed z-40 p-3 md:p-2 rounded-lg bg-bg-2 border border-border',
        'hover:border-gold hover:bg-bg-3 transition-all shadow-lg',
        'min-w-[44px] min-h-[44px] flex items-center justify-center',
        // Position: top-left on mobile, below header on desktop
        'left-4 top-4 lg:top-[4.5rem]'
      )}
      title="Open sidebar"
    >
      <svg className="w-5 h-5 text-text-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );

  // On desktop (lg+), show toggle when closed
  // On mobile/tablet (< lg), always show toggle (drawer opens over content)
  if (!sidebarOpen) {
    return <ToggleButton />;
  }

  // Sidebar content
  const SidebarContent = () => (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      exit={{ x: -280 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        'h-full bg-bg border-r border-border flex flex-col',
        // Width: full on mobile, fixed on tablet+
        'w-[280px] sm:w-64 lg:w-60'
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div
          className={cn(
            'flex items-center gap-2 cursor-pointer select-none',
            incognitoMode && 'text-pink-400'
          )}
          onClick={handleLogoClick}
          title={incognitoMode ? 'Click to exit incognito' : undefined}
        >
          <span className={cn('text-lg', incognitoMode ? 'text-pink-400' : 'text-gold')}>
            {incognitoMode ? '👁️‍🗨️' : '✦'}
          </span>
          <h1 className={cn('font-display text-lg', incognitoMode ? 'text-pink-400' : 'text-text')}>
            Lumière
          </h1>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-2.5 md:p-1.5 rounded-md hover:bg-bg-3 text-text-3 hover:text-text-2 transition-colors min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
        >
          <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Collections */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-medium text-text-3 uppercase tracking-wider">Collections</span>
          <button
            onClick={() => setIsCreating(true)}
            className="p-2.5 md:p-1 rounded hover:bg-bg-3 text-text-3 hover:text-gold transition-colors min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
            title="New collection"
          >
            <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* New batch input */}
        <AnimatePresence>
          {isCreating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-2"
            >
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') setIsCreating(false);
                }}
                placeholder="Collection name..."
                autoFocus
                className="w-full px-3 py-3 md:py-2 bg-bg-3 border border-border rounded-lg text-sm
                         focus:outline-none focus:border-gold text-text placeholder-text-3"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Incognito collection - shown when in incognito mode */}
        {incognitoMode && incognitoImages.length > 0 && (
          <div className="mb-3">
            <div
              onClick={() => {
                setActiveBatch(null);
                setViewingIncognitoCollection(true);
                setView('queue');
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={cn(
                'group px-3 py-3 md:py-2 rounded-lg cursor-pointer transition-all',
                'flex items-center gap-2 min-h-[44px] md:min-h-0',
                viewingIncognitoCollection
                  ? 'bg-pink-500/30 border border-pink-500 ring-1 ring-pink-500/50'
                  : 'bg-pink-500/20 border border-pink-500/50 hover:bg-pink-500/30'
              )}
            >
              <svg className="w-4 h-4 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              <span className="text-sm text-pink-400 font-medium flex-1">Incognito</span>
              <span className="text-xs text-pink-400/70">{incognitoImages.length}</span>
            </div>
          </div>
        )}

        {/* Batch list */}
        <div className="space-y-1">
          {batches.length === 0 && !isCreating && !incognitoMode && (
            <p className="text-text-muted text-xs px-3 py-4 text-center">
              No collections yet.
              <br />
              Create one to organize your images.
            </p>
          )}
          {batches.map((batch) => (
            <motion.div
              key={batch.id}
              layoutId={batch.id}
              onDragOver={(e) => handleDragOver(e, batch.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, batch.id)}
              onClick={() => handleBatchClick(batch.id)}
              className={cn(
                'group px-3 py-3 md:py-2 rounded-lg cursor-pointer transition-all',
                'flex items-center gap-2 min-h-[44px] md:min-h-0',
                activeBatchId === batch.id
                  ? 'bg-bg-4 border border-border-2'
                  : 'hover:bg-bg-3 border border-transparent active:bg-bg-4',
                dragOverId === batch.id && 'ring-2 ring-gold bg-gold/10 border-gold scale-[1.02] shadow-[0_0_12px_rgba(212,168,83,0.3)]'
              )}
            >
              <span
                className={cn(
                  'w-3 h-3 md:w-2.5 md:h-2.5 rounded-full shrink-0 transition-transform',
                  dragOverId === batch.id && 'scale-125'
                )}
                style={{ backgroundColor: batch.color }}
              />
              <span className={cn(
                'text-sm truncate flex-1 transition-colors',
                dragOverId === batch.id ? 'text-gold font-medium' : 'text-text'
              )}>
                {batch.name}
              </span>
              {dragOverId === batch.id ? (
                <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              ) : (
                <span className="text-xs text-text-3">{batch.images.length}</span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${batch.name}"?`)) {
                    deleteBatch(batch.id);
                  }
                }}
                className={cn(
                  'p-2 md:p-1 rounded hover:bg-err-dim text-text-3 hover:text-err transition-all',
                  'min-w-[36px] min-h-[36px] md:min-w-0 md:min-h-0 flex items-center justify-center',
                  dragOverId !== batch.id && 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
                )}
              >
                <svg className="w-4 h-4 md:w-3.5 md:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <button
          onClick={() => setIsCreating(true)}
          className={cn(
            'w-full min-h-[44px] px-4 py-2 rounded-lg font-medium text-sm',
            'flex items-center justify-center gap-2 transition-all',
            'bg-gold text-void hover:bg-gold-bright active:scale-95'
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Collection
        </button>
      </div>
    </motion.aside>
  );

  // On mobile/tablet (< lg): show as drawer with backdrop
  // On desktop (lg+): show inline
  return (
    <>
      {/* Mobile/Tablet: Backdrop + Drawer */}
      <div className="lg:hidden">
        <AnimatePresence>
          {sidebarOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-void/60 backdrop-blur-sm z-40"
              />
              {/* Drawer */}
              <div className="fixed inset-y-0 left-0 z-50">
                <SidebarContent />
              </div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop: Inline sidebar */}
      <div className="hidden lg:block">
        <SidebarContent />
      </div>
    </>
  );
}
