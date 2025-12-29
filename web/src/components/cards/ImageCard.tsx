import { useState, useRef } from 'react';
import { cn } from '../../utils/cn';
import { getImageUrl } from '../../api/server';
import { useStore } from '../../stores/store';
import { startDrag, endDrag, toggleDragSelect, useDragSelection, getDragSelectedFiles } from '../ui/DragLayer';
import { getFullPath } from '../../utils/constants';
import type { Assessment } from '../../types';

// Create a transparent 1x1 image for hiding native drag preview
let emptyDragImage: HTMLImageElement | null = null;
function getEmptyDragImage() {
  if (!emptyDragImage) {
    emptyDragImage = new Image();
    emptyDragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
  return emptyDragImage;
}

interface ImageCardProps {
  file: string;
  index: number;
  onOpen: () => void;
  onSelect?: () => void;
  isSelected?: boolean;
  isComparing?: boolean;
  onToggleCompare?: () => void;
  assessment?: Assessment;
  showActions?: boolean;
  draggable?: boolean;
  fixedAspect?: boolean;
  prompt?: string;
  model?: string;
}

export function ImageCard({
  file,
  index,
  onOpen,
  onSelect,
  isSelected,
  isComparing,
  onToggleCompare,
  assessment,
  showActions = true,
  draggable = true,
  fixedAspect = false,
  prompt,
  model,
}: ImageCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const clickTimer = useRef<number | null>(null);
  const dragSelection = useDragSelection();
  const isSelectedForDrag = dragSelection.includes(file);
  const addToast = useStore((s) => s.addToast);
  const toggleIncognito = useStore((s) => s.toggleIncognito);
  const incognitoImages = useStore((s) => s.incognitoImages);
  const isIncognito = incognitoImages.includes(file);

  const handleCopyPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (prompt) {
      navigator.clipboard.writeText(prompt);
      setCopied(true);
      addToast({ message: 'Prompt copied', type: 'success' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Command/Ctrl + click for multi-select
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      toggleDragSelect(file);
      return;
    }

    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      // Double-click toggles incognito mode (silent)
      toggleIncognito(file);
    } else {
      clickTimer.current = window.setTimeout(() => {
        clickTimer.current = null;
        onOpen();
      }, 200);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);

    // Get all files to drag (either selection or just this file)
    const filesToDrag = isSelectedForDrag ? getDragSelectedFiles() : [file];

    // Internal app use: custom MIME type with relative paths (for batches/refs)
    e.dataTransfer.setData('application/x-lumiere-files', JSON.stringify(filesToDrag));

    // Terminal/external: full absolute paths (space-separated for shell compatibility)
    const fullPaths = filesToDrag.map(f => getFullPath(f));
    e.dataTransfer.setData('text/plain', fullPaths.join(' '));

    e.dataTransfer.effectAllowed = 'copy';

    // Hide native drag preview by using a transparent image
    e.dataTransfer.setDragImage(getEmptyDragImage(), 0, 0);

    // Start custom drag layer
    startDrag(file, e.clientX, e.clientY);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    endDrag();
  };

  const handleImageLoad = () => {
    setIsLoaded(true);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-ok bg-ok-dim';
    if (score >= 6) return 'text-gold bg-gold-dim';
    if (score >= 4) return 'text-amber bg-amber-dim';
    return 'text-err bg-err-dim';
  };

  return (
    <div
      className={cn(
        'relative group rounded-lg overflow-hidden cursor-pointer h-full',
        'border-2 transition-all duration-200',
        isSelectedForDrag
          ? 'border-cyan ring-2 ring-cyan/30'
          : isSelected
          ? 'border-gold ring-2 ring-gold/30'
          : isComparing
          ? 'border-purple ring-2 ring-purple/30'
          : 'border-transparent hover:border-border-2',
        isDragging && 'opacity-50 scale-95'
      )}
      style={{
        animation: `scale-in 0.3s ease-out ${Math.min(index * 0.02, 0.3)}s backwards`,
      }}
      onClick={handleClick}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Loading shimmer - shown as min-height placeholder */}
      {!isLoaded && <div className={cn('w-full shimmer', fixedAspect ? 'h-full' : 'h-48')} />}

      {/* Image */}
      <img
        src={getImageUrl(file)}
        alt=""
        className={cn(
          'w-full transition-all duration-300',
          fixedAspect ? 'h-full object-cover' : 'h-auto',
          isLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
        )}
        onLoad={handleImageLoad}
        loading="lazy"
      />

      {/* Multi-select indicator - bottom left to avoid conflict with reference indicator */}
      {isSelectedForDrag && (
        <div className="absolute bottom-2 left-2 w-5 h-5 rounded-full bg-cyan text-void flex items-center justify-center z-10 shadow-sm">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-gold text-void flex items-center justify-center">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Incognito indicator */}
      {isIncognito && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-pink-500 text-white flex items-center justify-center z-10" title="Incognito">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        </div>
      )}

      {/* Compare indicator */}
      {isComparing && (
        <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-purple text-void flex items-center justify-center">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}

      {/* Assessment badge */}
      {assessment && (
        <div
          className={cn(
            'absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs font-bold',
            'flex items-center gap-1 group/badge cursor-default',
            getScoreColor(assessment.score)
          )}
          title={`Score: ${assessment.score}/10`}
        >
          {/* Verdict icon */}
          {assessment.score >= 8 ? (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : assessment.score >= 6 ? (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          {assessment.score}
        </div>
      )}

      {/* Hover/touch overlay with actions */}
      {showActions && (
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-t from-void/80 via-transparent to-transparent',
            // Show on hover (desktop) or always show subtle on touch devices
            'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
            // On touch devices, show actions when selected/comparing
            (isSelected || isComparing) && 'opacity-100',
            'flex items-end justify-center p-2 gap-1.5'
          )}
        >
          {/* Reference button - 44px minimum touch target */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.();
            }}
            className={cn(
              'p-2 sm:p-1.5 rounded-md backdrop-blur-sm transition-all',
              'min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0',
              'flex items-center justify-center',
              isSelected
                ? 'bg-gold text-void'
                : 'bg-bg/60 text-text hover:bg-gold hover:text-void active:bg-gold active:text-void'
            )}
            title="Use as reference (double-click)"
          >
            <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Compare button - 44px minimum touch target */}
          {onToggleCompare && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleCompare();
              }}
              className={cn(
                'p-2 sm:p-1.5 rounded-md backdrop-blur-sm transition-all',
                'min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0',
                'flex items-center justify-center',
                isComparing
                  ? 'bg-purple text-void'
                  : 'bg-bg/60 text-text hover:bg-purple hover:text-void active:bg-purple active:text-void'
              )}
              title="Add to comparison"
            >
              <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Prompt info button */}
          {prompt && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPrompt(!showPrompt);
              }}
              className={cn(
                'p-2 sm:p-1.5 rounded-md backdrop-blur-sm transition-all',
                'min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0',
                'flex items-center justify-center',
                showPrompt
                  ? 'bg-cyan text-void'
                  : 'bg-bg/60 text-text hover:bg-cyan hover:text-void'
              )}
              title="View prompt"
            >
              <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Prompt popup */}
      {showPrompt && prompt && (
        <div
          className="absolute inset-x-2 bottom-2 bg-void/95 backdrop-blur-sm rounded-lg p-2 z-20 border border-border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-2">
            <p className="text-[10px] text-text-2 flex-1 line-clamp-3 leading-relaxed">{prompt}</p>
            <button
              onClick={handleCopyPrompt}
              className={cn(
                'p-1.5 rounded transition-all shrink-0',
                copied ? 'bg-ok text-void' : 'bg-bg-3 text-text-3 hover:text-text hover:bg-bg-4'
              )}
              title="Copy prompt"
            >
              {copied ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
          {model && (
            <p className="text-[9px] text-text-3 mt-1 truncate">{model}</p>
          )}
        </div>
      )}
    </div>
  );
}

// Processing card variant
export function ProcessingCard({ model, status }: { model: string; status: 'pending' | 'processing' }) {
  const zoom = useStore((s) => s.zoom);
  const baseSize = 180;
  const size = Math.round(baseSize * zoom);

  return (
    <div
      className="relative rounded-lg overflow-hidden border-2 border-border bg-bg-3
                 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {status === 'processing' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
        </div>
      )}

      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <span className="text-xs text-text-3 truncate">{model}</span>
        <span
          className={cn(
            'text-xs px-1.5 py-0.5 rounded',
            status === 'processing' ? 'bg-gold-dim text-gold' : 'bg-bg-4 text-text-3'
          )}
        >
          {status === 'processing' ? 'generating' : 'queued'}
        </span>
      </div>
    </div>
  );
}
