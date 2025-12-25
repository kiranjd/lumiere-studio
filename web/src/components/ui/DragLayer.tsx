import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getImageUrl } from '../../api/server';

interface DragState {
  isDragging: boolean;
  files: string[];
  x: number;
  y: number;
}

// Global drag state - shared across components
let dragListeners: ((state: DragState) => void)[] = [];
let currentDragState: DragState = { isDragging: false, files: [], x: 0, y: 0 };

// Multi-select state
let selectedForDrag: Set<string> = new Set();
let selectListeners: ((files: string[]) => void)[] = [];

export function setDragState(state: Partial<DragState>) {
  currentDragState = { ...currentDragState, ...state };
  dragListeners.forEach(listener => listener(currentDragState));
}

export function startDrag(file: string, x: number, y: number) {
  // If the dragged file is in selection, drag all selected
  // Otherwise just drag this one file
  const files = selectedForDrag.has(file)
    ? Array.from(selectedForDrag)
    : [file];
  setDragState({ isDragging: true, files, x, y });
}

export function updateDragPosition(x: number, y: number) {
  if (currentDragState.isDragging) {
    setDragState({ x, y });
  }
}

export function endDrag() {
  setDragState({ isDragging: false, files: [] });
}

// Multi-select functions
export function toggleDragSelect(file: string) {
  if (selectedForDrag.has(file)) {
    selectedForDrag.delete(file);
  } else {
    selectedForDrag.add(file);
  }
  selectListeners.forEach(l => l(Array.from(selectedForDrag)));
}

export function clearDragSelect() {
  selectedForDrag.clear();
  selectListeners.forEach(l => l([]));
}

export function isDragSelected(file: string): boolean {
  return selectedForDrag.has(file);
}

export function getDragSelectedFiles(): string[] {
  return Array.from(selectedForDrag);
}

export function useDragSelection() {
  const [selected, setSelected] = useState<string[]>(Array.from(selectedForDrag));

  useEffect(() => {
    const listener = (files: string[]) => setSelected(files);
    selectListeners.push(listener);
    return () => {
      selectListeners = selectListeners.filter(l => l !== listener);
    };
  }, []);

  return selected;
}

export function DragLayer() {
  const [dragState, setLocalDragState] = useState<DragState>(currentDragState);

  useEffect(() => {
    const listener = (state: DragState) => setLocalDragState({ ...state });
    dragListeners.push(listener);
    return () => {
      dragListeners = dragListeners.filter(l => l !== listener);
    };
  }, []);

  // Track mouse position during drag
  useEffect(() => {
    const handleDrag = (e: DragEvent) => {
      if (dragState.isDragging && e.clientX !== 0 && e.clientY !== 0) {
        updateDragPosition(e.clientX, e.clientY);
      }
    };

    const handleDragEnd = () => {
      endDrag();
    };

    document.addEventListener('drag', handleDrag);
    document.addEventListener('dragend', handleDragEnd);

    return () => {
      document.removeEventListener('drag', handleDrag);
      document.removeEventListener('dragend', handleDragEnd);
    };
  }, [dragState.isDragging]);

  if (!dragState.isDragging || dragState.files.length === 0) return null;

  const count = dragState.files.length;
  const showStack = count > 1;

  return createPortal(
    <div
      className="fixed pointer-events-none z-[9999]"
      style={{
        left: dragState.x,
        top: dragState.y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Stacked preview for multiple images */}
      <div className="relative">
        {/* Background cards for stack effect */}
        {showStack && (
          <>
            <div className="absolute w-16 h-16 rounded-lg bg-bg-3 border border-border -rotate-6 -translate-x-1 -translate-y-1" />
            <div className="absolute w-16 h-16 rounded-lg bg-bg-3 border border-border rotate-3 translate-x-1" />
          </>
        )}
        {/* Main image */}
        <div className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-gold bg-bg shadow-lg shadow-black/50">
          <img
            src={getImageUrl(dragState.files[0])}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        {/* Count badge */}
        {showStack && (
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gold text-void text-xs font-bold flex items-center justify-center shadow-md">
            {count}
          </div>
        )}
      </div>
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gold text-void text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap shadow">
        {count > 1 ? `Drop ${count} images` : 'Drop to add'}
      </div>
    </div>,
    document.body
  );
}
