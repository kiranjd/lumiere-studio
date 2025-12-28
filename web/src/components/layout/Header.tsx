import { useStore } from '../../stores/store';
import { cn } from '../../utils/cn';
import type { ViewType } from '../../types';

export function Header() {
  const currentView = useStore((s) => s.currentView);
  const setView = useStore((s) => s.setView);
  const queue = useStore((s) => s.queue);
  const generatedImages = useStore((s) => s.generatedImages);
  const library = useStore((s) => s.library);
  const activeBatchId = useStore((s) => s.activeBatchId);
  const batches = useStore((s) => s.batches);
  const zoom = useStore((s) => s.zoom);
  const setZoom = useStore((s) => s.setZoom);
  const setViewingIncognitoCollection = useStore((s) => s.setViewingIncognitoCollection);
  const setShowSettings = useStore((s) => s.setShowSettings);
  const apiKeys = useStore((s) => s.apiKeys);

  const hasApiKeys = apiKeys.openrouter || apiKeys.openai;

  const activeBatch = batches.find((b) => b.id === activeBatchId);
  const processingCount = queue.filter((q) => q.status === 'processing').length;
  const pendingCount = queue.filter((q) => q.status === 'pending').length;

  const tabs: Array<{ id: ViewType; label: string; shortLabel?: string; count?: number }> = [
    {
      id: 'queue',
      label: 'Generated',
      shortLabel: 'Gen',
      count: generatedImages.length + processingCount + pendingCount,
    },
    { id: 'library', label: 'Library', shortLabel: 'Lib', count: library.length },
  ];

  // Add batch tab if one is selected
  if (activeBatch) {
    tabs.push({
      id: 'batch',
      label: activeBatch.name,
      shortLabel: activeBatch.name.slice(0, 6),
      count: activeBatch.images.length,
    });
  }

  return (
    <header className="h-14 bg-bg border-b border-border flex items-center justify-between px-3 md:px-4 gap-2">
      {/* View tabs - scrollable on mobile */}
      <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 md:flex-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setViewingIncognitoCollection(false);
              setView(tab.id);
            }}
            className={cn(
              'px-3 py-2 md:px-4 rounded-lg text-sm font-medium transition-all shrink-0',
              'flex items-center gap-1.5 md:gap-2 min-h-[40px]',
              currentView === tab.id
                ? 'bg-bg-3 text-text border border-border'
                : 'text-text-2 hover:text-text hover:bg-bg-2 active:bg-bg-3'
            )}
          >
            {/* Short label on mobile, full on tablet+ */}
            <span className="md:hidden">{tab.shortLabel || tab.label}</span>
            <span className="hidden md:inline">{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded hidden sm:inline',
                  currentView === tab.id ? 'bg-bg-4 text-text-2' : 'bg-bg-3 text-text-3'
                )}
              >
                {tab.count}
              </span>
            )}
            {/* Processing indicator */}
            {tab.id === 'queue' && processingCount > 0 && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-gold" />
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Right side controls */}
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        {/* Publish link */}
        <button
          onClick={() => {
            setViewingIncognitoCollection(false);
            setView('publish');
          }}
          className={cn(
            'px-2.5 py-2 md:px-3 md:py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-sm font-medium',
            'min-h-[40px] min-w-[40px] justify-center',
            currentView === 'publish'
              ? 'bg-gold text-void'
              : 'text-gold hover:bg-gold/10 active:bg-gold/20'
          )}
          title="Publish Queue"
        >
          <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          <span className="hidden md:inline">Publish</span>
        </button>

        {/* Archive link */}
        <button
          onClick={() => {
            setViewingIncognitoCollection(false);
            setView('archive');
          }}
          className={cn(
            'p-2.5 md:p-2 rounded-lg transition-colors flex items-center justify-center',
            'min-h-[40px] min-w-[40px]',
            currentView === 'archive'
              ? 'bg-bg-3 text-text'
              : 'text-text-3 hover:text-text hover:bg-bg-2 active:bg-bg-3'
          )}
          title="Archive"
        >
          <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </button>

        {/* Settings */}
        <button
          onClick={() => setShowSettings(true)}
          className={cn(
            'p-2.5 md:p-2 rounded-lg transition-colors flex items-center justify-center relative',
            'min-h-[40px] min-w-[40px]',
            'text-text-3 hover:text-text hover:bg-bg-2 active:bg-bg-3'
          )}
          title="API Keys & Settings"
        >
          <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {/* Warning dot if no API keys */}
          {!hasApiKeys && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-bg" />
          )}
        </button>

        {/* Zoom control - hidden on mobile */}
        <div className="hidden md:flex items-center gap-2">
          <div className="w-px h-5 bg-border" />
          <button
            onClick={() => setZoom(zoom - 0.25)}
            disabled={zoom <= 0.5}
            className="p-1.5 rounded text-text-3 hover:text-text hover:bg-bg-3
                     disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-xs text-text-3 min-w-[3ch] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(zoom + 0.25)}
            disabled={zoom >= 2}
            className="p-1.5 rounded text-text-3 hover:text-text hover:bg-bg-3
                     disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Stats - hidden on small screens */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-text-3">
          {processingCount > 0 && (
            <span className="flex items-center gap-1.5 text-gold">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
              {processingCount} generating
            </span>
          )}
          {pendingCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-text-3" />
              {pendingCount} queued
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
