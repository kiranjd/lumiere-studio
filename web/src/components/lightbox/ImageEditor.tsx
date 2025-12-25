import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';

interface ImageEditorProps {
  imageUrl: string;
  onSave: (editedImageDataUrl: string) => void;
  onCancel: () => void;
  onGridSave?: (images: { dataUrl: string; index: number }[]) => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GridSize {
  rows: number;
  cols: number;
}

interface GridBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Crop presets with aspect ratios
const CROP_PRESETS = [
  { id: 'free', label: 'Free', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '2:3', label: '2:3', ratio: 2 / 3 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
] as const;

type CropPresetId = typeof CROP_PRESETS[number]['id'];

// Grid Picker Component - hover to select dimensions like table creation
function GridPicker({ onSelect, onClose }: { onSelect: (size: GridSize) => void; onClose: () => void }) {
  const [hovered, setHovered] = useState<GridSize | null>(null);
  const maxSize = 6;

  return (
    <div
      className="absolute top-full left-0 mt-2 p-3 bg-bg-2 border border-border rounded-lg shadow-xl z-50"
      onMouseLeave={() => setHovered(null)}
    >
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${maxSize}, 1fr)` }}>
        {Array.from({ length: maxSize * maxSize }).map((_, i) => {
          const row = Math.floor(i / maxSize) + 1;
          const col = (i % maxSize) + 1;
          const isHighlighted = hovered && row <= hovered.rows && col <= hovered.cols;

          return (
            <button
              key={i}
              className={cn(
                "w-6 h-6 border rounded transition-colors",
                isHighlighted
                  ? "bg-gold border-gold"
                  : "bg-bg-3 border-border hover:border-text-3"
              )}
              onMouseEnter={() => setHovered({ rows: row, cols: col })}
              onClick={() => {
                onSelect({ rows: row, cols: col });
                onClose();
              }}
            />
          );
        })}
      </div>
      <div className="mt-2 text-center text-sm text-text-2">
        {hovered ? `${hovered.cols} × ${hovered.rows}` : 'Select grid size'}
      </div>
    </div>
  );
}

export function ImageEditor({ imageUrl, onSave, onCancel, onGridSave }: ImageEditorProps) {
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Crop state - new preset-based system
  const [cropPreset, setCropPreset] = useState<CropPresetId | null>(null);
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [cropDragType, setCropDragType] = useState<string | null>(null);
  const [cropDragStart, setCropDragStart] = useState({ x: 0, y: 0, area: null as CropArea | null });
  const [cropZoom, setCropZoom] = useState(1);
  const [appliedCropPreview, setAppliedCropPreview] = useState<string | null>(null); // Data URL of applied crop

  // Undo history - stores previous states (null = original image)
  const [history, setHistory] = useState<(string | null)[]>([]);

  // Grid mode state
  const [showGridPicker, setShowGridPicker] = useState(false);
  const [gridSize, setGridSize] = useState<GridSize | null>(null);
  const [gridBounds, setGridBounds] = useState<GridBounds | null>(null);
  const [gridDragType, setGridDragType] = useState<string | null>(null);
  const [gridDragStart, setGridDragStart] = useState({ x: 0, y: 0, bounds: null as GridBounds | null });
  const [savingProgress, setSavingProgress] = useState<{ current: number; total: number } | null>(null);

  // Image dimensions for crop bounds
  const [imageBounds, setImageBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasEdits = rotation !== 0 || flipH || flipV || cropArea !== null || appliedCropPreview !== null;
  const isGridMode = gridSize !== null && gridBounds !== null;
  const isCropMode = cropPreset !== null;
  const canUndo = history.length > 0;
  const canRevert = appliedCropPreview !== null;

  // Update image bounds when image loads or container resizes
  const updateImageBounds = useCallback(() => {
    if (imageRef.current && containerRef.current && imageLoaded) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const imgRect = imageRef.current.getBoundingClientRect();
      if (imgRect.width > 0 && imgRect.height > 0) {
        setImageBounds({
          x: imgRect.left - containerRect.left,
          y: imgRect.top - containerRect.top,
          width: imgRect.width,
          height: imgRect.height,
        });
      }
    }
  }, [imageLoaded]);

  useEffect(() => {
    updateImageBounds();
    window.addEventListener('resize', updateImageBounds);
    return () => window.removeEventListener('resize', updateImageBounds);
  }, [updateImageBounds, cropZoom]);

  // Handle image load
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    // Small delay to ensure layout is complete
    setTimeout(() => {
      if (imageRef.current && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const imgRect = imageRef.current.getBoundingClientRect();
        if (imgRect.width > 0 && imgRect.height > 0) {
          setImageBounds({
            x: imgRect.left - containerRect.left,
            y: imgRect.top - containerRect.top,
            width: imgRect.width,
            height: imgRect.height,
          });
        }
      }
    }, 50);
  }, []);

  // Initialize crop area when preset is selected
  useEffect(() => {
    if (cropPreset && imageBounds) {
      const preset = CROP_PRESETS.find(p => p.id === cropPreset);
      if (!preset) return;

      let cropW: number, cropH: number;

      if (preset.ratio === null) {
        // Free crop - default to 80% of image
        cropW = imageBounds.width * 0.8;
        cropH = imageBounds.height * 0.8;
      } else {
        // Calculate crop size to fit within image while maintaining aspect ratio
        const imgRatio = imageBounds.width / imageBounds.height;
        if (preset.ratio > imgRatio) {
          // Crop is wider than image - constrain by width
          cropW = imageBounds.width * 0.9;
          cropH = cropW / preset.ratio;
        } else {
          // Crop is taller than image - constrain by height
          cropH = imageBounds.height * 0.9;
          cropW = cropH * preset.ratio;
        }
      }

      // Center the crop area on the image
      setCropArea({
        x: imageBounds.x + (imageBounds.width - cropW) / 2,
        y: imageBounds.y + (imageBounds.height - cropH) / 2,
        width: cropW,
        height: cropH,
      });
    }
  }, [cropPreset, imageBounds]);

  // Initialize grid bounds when grid size is selected
  useEffect(() => {
    if (gridSize && imageBounds) {
      setGridBounds({
        x: imageBounds.x,
        y: imageBounds.y,
        width: imageBounds.width,
        height: imageBounds.height,
      });
    }
  }, [gridSize, imageBounds]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+Z for undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        // Inline undo logic to avoid stale closure
        setHistory((prev) => {
          if (prev.length === 0) return prev;
          const newHistory = [...prev];
          const previousState = newHistory.pop();
          setAppliedCropPreview(previousState ?? null);
          setRotation(0);
          setFlipH(false);
          setFlipV(false);
          setCropArea(null);
          setCropPreset(null);
          setCropZoom(1);
          return newHistory;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRotateLeft = () => setRotation((r) => (r - 90) % 360);
  const handleRotateRight = () => setRotation((r) => (r + 90) % 360);
  const handleFlipH = () => setFlipH((f) => !f);
  const handleFlipV = () => setFlipV((f) => !f);

  const handleReset = () => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setCropArea(null);
    setCropPreset(null);
    setCropZoom(1);
    setGridSize(null);
    setGridBounds(null);
    setAppliedCropPreview(null);
    setHistory([]);
  };

  // Undo - go back to previous state
  const handleUndo = () => {
    if (history.length === 0) return;

    const newHistory = [...history];
    const previousState = newHistory.pop();
    setHistory(newHistory);
    setAppliedCropPreview(previousState ?? null);

    // Reset any in-progress edits
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setCropArea(null);
    setCropPreset(null);
    setCropZoom(1);
  };

  // Revert to original image
  const handleRevert = () => {
    setAppliedCropPreview(null);
    setHistory([]);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setCropArea(null);
    setCropPreset(null);
    setCropZoom(1);
  };

  const handleCropPresetSelect = (presetId: CropPresetId) => {
    setCropPreset(presetId);
    setGridSize(null);
    setGridBounds(null);
    setCropZoom(1);
  };

  const exitCropMode = () => {
    setCropPreset(null);
    setCropArea(null);
    setCropZoom(1);
  };

  // Apply crop to generate a preview (without saving to server)
  const applyCrop = async () => {
    if (!cropArea || !imageBounds) return;
    setIsSaving(true);

    try {
      // Load the original image (or current preview if one exists)
      const originalImg = new Image();
      originalImg.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        originalImg.onload = () => resolve();
        originalImg.onerror = reject;
        originalImg.src = appliedCropPreview || imageUrl;
      });

      // If using existing preview, scale factors are 1:1
      // Otherwise calculate from display bounds
      const scaleX = appliedCropPreview ? 1 : originalImg.width / imageBounds.width;
      const scaleY = appliedCropPreview ? 1 : originalImg.height / imageBounds.height;

      // Calculate crop position relative to image (in display coords)
      const cropRelX = cropArea.x - imageBounds.x;
      const cropRelY = cropArea.y - imageBounds.y;

      // Output dimensions in original image scale
      const outputW = Math.round(cropArea.width * scaleX);
      const outputH = Math.round(cropArea.height * scaleY);

      // Adjust for rotation
      const isRotated90 = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;
      const finalW = isRotated90 ? outputH : outputW;
      const finalH = isRotated90 ? outputW : outputH;

      const canvas = document.createElement('canvas');
      canvas.width = finalW;
      canvas.height = finalH;
      const ctx = canvas.getContext('2d')!;

      // Always fill with green first (for any out-of-bounds areas)
      ctx.fillStyle = '#00FF00';
      ctx.fillRect(0, 0, finalW, finalH);

      // Apply transformations
      ctx.translate(finalW / 2, finalH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

      // Calculate source and destination rectangles
      const srcX = Math.max(0, cropRelX) * scaleX;
      const srcY = Math.max(0, cropRelY) * scaleY;
      const srcRight = Math.min(imageBounds.width, cropRelX + cropArea.width) * scaleX;
      const srcBottom = Math.min(imageBounds.height, cropRelY + cropArea.height) * scaleY;
      const srcW = Math.max(0, srcRight - srcX);
      const srcH = Math.max(0, srcBottom - srcY);

      // Destination: where to draw on the output canvas
      const dstX = Math.max(0, -cropRelX) * scaleX - outputW / 2;
      const dstY = Math.max(0, -cropRelY) * scaleY - outputH / 2;

      // Draw the image portion
      if (srcW > 0 && srcH > 0) {
        ctx.drawImage(
          originalImg,
          srcX, srcY, srcW, srcH,
          dstX, dstY, srcW, srcH
        );
      }

      const dataUrl = canvas.toDataURL('image/png');

      // Push current state to history before applying new crop
      setHistory((prev) => [...prev, appliedCropPreview]);

      // Store preview and reset crop state for next crop
      setAppliedCropPreview(dataUrl);
      setCropPreset(null);
      setCropArea(null);
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setCropZoom(1);
    } catch (error) {
      console.error('Failed to apply crop:', error);
    }

    setIsSaving(false);
  };

  const handleGridSelect = (size: GridSize) => {
    setGridSize(size);
    setCropPreset(null);
    setCropArea(null);
  };

  const exitGridMode = () => {
    setGridSize(null);
    setGridBounds(null);
  };

  // Crop drag handlers - coordinates in screen space (includes zoom)
  const handleCropMouseDown = useCallback((e: React.MouseEvent, dragType: string) => {
    if (!cropArea || !containerRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    setCropDragType(dragType);
    setCropDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      area: { ...cropArea },
    });
  }, [cropArea]);

  const handleCropMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cropDragType || !cropDragStart.area || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - containerRect.left;
    const currentY = e.clientY - containerRect.top;
    const deltaX = currentX - cropDragStart.x;
    const deltaY = currentY - cropDragStart.y;

    const preset = CROP_PRESETS.find(p => p.id === cropPreset);
    const ratio = preset?.ratio || null;
    const minSize = 50;

    let newArea = { ...cropDragStart.area };

    if (cropDragType === 'move') {
      // Move the crop area - no bounds restriction (can go outside image)
      newArea.x = cropDragStart.area.x + deltaX;
      newArea.y = cropDragStart.area.y + deltaY;
    } else {
      // Resize with aspect ratio lock
      switch (cropDragType) {
        case 'se': {
          let newW = Math.max(minSize, cropDragStart.area.width + deltaX);
          let newH = ratio ? newW / ratio : Math.max(minSize, cropDragStart.area.height + deltaY);
          if (ratio) newW = newH * ratio;
          newArea.width = newW;
          newArea.height = newH;
          break;
        }
        case 'sw': {
          let newW = Math.max(minSize, cropDragStart.area.width - deltaX);
          let newH = ratio ? newW / ratio : Math.max(minSize, cropDragStart.area.height + deltaY);
          if (ratio) newW = newH * ratio;
          newArea.x = cropDragStart.area.x + cropDragStart.area.width - newW;
          newArea.width = newW;
          newArea.height = newH;
          break;
        }
        case 'ne': {
          let newW = Math.max(minSize, cropDragStart.area.width + deltaX);
          let newH = ratio ? newW / ratio : Math.max(minSize, cropDragStart.area.height - deltaY);
          if (ratio) newW = newH * ratio;
          newArea.y = cropDragStart.area.y + cropDragStart.area.height - newH;
          newArea.width = newW;
          newArea.height = newH;
          break;
        }
        case 'nw': {
          let newW = Math.max(minSize, cropDragStart.area.width - deltaX);
          let newH = ratio ? newW / ratio : Math.max(minSize, cropDragStart.area.height - deltaY);
          if (ratio) newW = newH * ratio;
          newArea.x = cropDragStart.area.x + cropDragStart.area.width - newW;
          newArea.y = cropDragStart.area.y + cropDragStart.area.height - newH;
          newArea.width = newW;
          newArea.height = newH;
          break;
        }
      }
    }

    setCropArea(newArea);
  }, [cropDragType, cropDragStart, cropPreset]);

  const handleMouseUp = useCallback(() => {
    setCropDragType(null);
    setGridDragType(null);
  }, []);

  // Grid resize handlers - coordinates in screen space (includes zoom)
  const handleGridMouseDown = useCallback((e: React.MouseEvent, dragType: string) => {
    if (!gridBounds || !containerRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    setGridDragType(dragType);
    setGridDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      bounds: { ...gridBounds },
    });
  }, [gridBounds]);

  const handleGridMouseMove = useCallback((e: React.MouseEvent) => {
    if (!gridDragType || !gridDragStart.bounds || !containerRef.current || !imageBounds) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - containerRect.left;
    const currentY = e.clientY - containerRect.top;
    const deltaX = currentX - gridDragStart.x;
    const deltaY = currentY - gridDragStart.y;

    const minSize = 50;
    let newBounds = { ...gridDragStart.bounds };

    switch (gridDragType) {
      case 'move':
        newBounds.x = Math.max(imageBounds.x, Math.min(imageBounds.x + imageBounds.width - newBounds.width, gridDragStart.bounds.x + deltaX));
        newBounds.y = Math.max(imageBounds.y, Math.min(imageBounds.y + imageBounds.height - newBounds.height, gridDragStart.bounds.y + deltaY));
        break;
      case 'nw':
        newBounds.x = Math.max(imageBounds.x, Math.min(gridDragStart.bounds.x + gridDragStart.bounds.width - minSize, gridDragStart.bounds.x + deltaX));
        newBounds.y = Math.max(imageBounds.y, Math.min(gridDragStart.bounds.y + gridDragStart.bounds.height - minSize, gridDragStart.bounds.y + deltaY));
        newBounds.width = gridDragStart.bounds.width - (newBounds.x - gridDragStart.bounds.x);
        newBounds.height = gridDragStart.bounds.height - (newBounds.y - gridDragStart.bounds.y);
        break;
      case 'ne':
        newBounds.y = Math.max(imageBounds.y, Math.min(gridDragStart.bounds.y + gridDragStart.bounds.height - minSize, gridDragStart.bounds.y + deltaY));
        newBounds.width = Math.max(minSize, Math.min(imageBounds.x + imageBounds.width - gridDragStart.bounds.x, gridDragStart.bounds.width + deltaX));
        newBounds.height = gridDragStart.bounds.height - (newBounds.y - gridDragStart.bounds.y);
        break;
      case 'sw':
        newBounds.x = Math.max(imageBounds.x, Math.min(gridDragStart.bounds.x + gridDragStart.bounds.width - minSize, gridDragStart.bounds.x + deltaX));
        newBounds.width = gridDragStart.bounds.width - (newBounds.x - gridDragStart.bounds.x);
        newBounds.height = Math.max(minSize, Math.min(imageBounds.y + imageBounds.height - gridDragStart.bounds.y, gridDragStart.bounds.height + deltaY));
        break;
      case 'se':
        newBounds.width = Math.max(minSize, Math.min(imageBounds.x + imageBounds.width - gridDragStart.bounds.x, gridDragStart.bounds.width + deltaX));
        newBounds.height = Math.max(minSize, Math.min(imageBounds.y + imageBounds.height - gridDragStart.bounds.y, gridDragStart.bounds.height + deltaY));
        break;
      case 'n':
        newBounds.y = Math.max(imageBounds.y, Math.min(gridDragStart.bounds.y + gridDragStart.bounds.height - minSize, gridDragStart.bounds.y + deltaY));
        newBounds.height = gridDragStart.bounds.height - (newBounds.y - gridDragStart.bounds.y);
        break;
      case 's':
        newBounds.height = Math.max(minSize, Math.min(imageBounds.y + imageBounds.height - gridDragStart.bounds.y, gridDragStart.bounds.height + deltaY));
        break;
      case 'w':
        newBounds.x = Math.max(imageBounds.x, Math.min(gridDragStart.bounds.x + gridDragStart.bounds.width - minSize, gridDragStart.bounds.x + deltaX));
        newBounds.width = gridDragStart.bounds.width - (newBounds.x - gridDragStart.bounds.x);
        break;
      case 'e':
        newBounds.width = Math.max(minSize, Math.min(imageBounds.x + imageBounds.width - gridDragStart.bounds.x, gridDragStart.bounds.width + deltaX));
        break;
    }

    setGridBounds(newBounds);
  }, [gridDragType, gridDragStart, imageBounds]);

  // Batch crop all grid cells
  const handleGridCrop = async () => {
    if (!gridSize || !gridBounds || !imageRef.current || !containerRef.current || !imageBounds) return;

    setIsSaving(true);
    const total = gridSize.rows * gridSize.cols;
    setSavingProgress({ current: 0, total });

    try {
      // Load the original image
      const originalImg = new Image();
      originalImg.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        originalImg.onload = () => resolve();
        originalImg.onerror = reject;
        originalImg.src = imageUrl;
      });

      // Calculate scale factors
      const scaleX = originalImg.width / imageBounds.width;
      const scaleY = originalImg.height / imageBounds.height;

      const cellWidth = gridBounds.width / gridSize.cols;
      const cellHeight = gridBounds.height / gridSize.rows;

      const results: { dataUrl: string; index: number }[] = [];

      // Crop each cell
      for (let row = 0; row < gridSize.rows; row++) {
        for (let col = 0; col < gridSize.cols; col++) {
          const index = row * gridSize.cols + col + 1;
          setSavingProgress({ current: index, total });

          // Cell position in container coordinates
          const cellX = gridBounds.x + col * cellWidth;
          const cellY = gridBounds.y + row * cellHeight;

          // Convert to original image coordinates
          const sourceX = Math.max(0, (cellX - imageBounds.x) * scaleX);
          const sourceY = Math.max(0, (cellY - imageBounds.y) * scaleY);
          const sourceW = Math.min(originalImg.width - sourceX, cellWidth * scaleX);
          const sourceH = Math.min(originalImg.height - sourceY, cellHeight * scaleY);

          // Create canvas for this cell
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;

          // Determine output size based on rotation
          const isRotated90 = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;
          const outputW = isRotated90 ? sourceH : sourceW;
          const outputH = isRotated90 ? sourceW : sourceH;

          canvas.width = outputW;
          canvas.height = outputH;

          // Apply transformations
          ctx.translate(outputW / 2, outputH / 2);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

          // Draw the cell
          ctx.drawImage(
            originalImg,
            sourceX, sourceY, sourceW, sourceH,
            -sourceW / 2, -sourceH / 2, sourceW, sourceH
          );

          results.push({
            dataUrl: canvas.toDataURL('image/png'),
            index,
          });
        }
      }

      // Call the callback with all cropped images
      if (onGridSave) {
        onGridSave(results);
      }

      // Exit grid mode after successful save
      exitGridMode();
    } catch (error) {
      console.error('Failed to crop grid:', error);
    }

    setIsSaving(false);
    setSavingProgress(null);
  };

  const handleSave = async () => {
    if (!imageRef.current || !imageBounds) return;
    setIsSaving(true);

    try {
      // If we have an applied crop preview with no additional edits, save it directly
      if (appliedCropPreview && !cropArea && rotation === 0 && !flipH && !flipV) {
        onSave(appliedCropPreview);
        setIsSaving(false);
        return;
      }

      // Load the image (preview if exists, otherwise original)
      const originalImg = new Image();
      originalImg.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        originalImg.onload = () => resolve();
        originalImg.onerror = reject;
        originalImg.src = appliedCropPreview || imageUrl;
      });

      const scaleX = originalImg.width / imageBounds.width;
      const scaleY = originalImg.height / imageBounds.height;

      let outputW: number, outputH: number;

      if (cropArea) {
        // Calculate crop position relative to image (in display coords)
        const cropRelX = cropArea.x - imageBounds.x;
        const cropRelY = cropArea.y - imageBounds.y;

        // Output dimensions in original image scale
        outputW = Math.round(cropArea.width * scaleX);
        outputH = Math.round(cropArea.height * scaleY);

        // Adjust for rotation
        const isRotated90 = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;
        const finalW = isRotated90 ? outputH : outputW;
        const finalH = isRotated90 ? outputW : outputH;

        const canvas = document.createElement('canvas');
        canvas.width = finalW;
        canvas.height = finalH;
        const ctx = canvas.getContext('2d')!;

        // Always fill with green first (for any out-of-bounds areas)
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(0, 0, finalW, finalH);

        // Apply transformations
        ctx.translate(finalW / 2, finalH / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

        // Calculate source and destination rectangles
        // Source: the portion of original image to copy (clamped to image bounds)
        const srcX = Math.max(0, cropRelX) * scaleX;
        const srcY = Math.max(0, cropRelY) * scaleY;
        const srcRight = Math.min(imageBounds.width, cropRelX + cropArea.width) * scaleX;
        const srcBottom = Math.min(imageBounds.height, cropRelY + cropArea.height) * scaleY;
        const srcW = Math.max(0, srcRight - srcX);
        const srcH = Math.max(0, srcBottom - srcY);

        // Destination: where to draw on the output canvas (offset for out-of-bounds)
        const dstX = Math.max(0, -cropRelX) * scaleX - outputW / 2;
        const dstY = Math.max(0, -cropRelY) * scaleY - outputH / 2;

        // Draw the image portion (green fill shows through for out-of-bounds areas)
        if (srcW > 0 && srcH > 0) {
          ctx.drawImage(
            originalImg,
            srcX, srcY, srcW, srcH,
            dstX, dstY, srcW, srcH
          );
        }

        const dataUrl = canvas.toDataURL('image/png');
        onSave(dataUrl);
      } else {
        // No crop - just apply rotation/flip
        outputW = originalImg.width;
        outputH = originalImg.height;

        const isRotated90 = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;
        const finalW = isRotated90 ? outputH : outputW;
        const finalH = isRotated90 ? outputW : outputH;

        const canvas = document.createElement('canvas');
        canvas.width = finalW;
        canvas.height = finalH;
        const ctx = canvas.getContext('2d')!;

        ctx.translate(finalW / 2, finalH / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

        ctx.drawImage(originalImg, -outputW / 2, -outputH / 2);

        const dataUrl = canvas.toDataURL('image/png');
        onSave(dataUrl);
      }
    } catch (error) {
      console.error('Failed to save edited image:', error);
    }

    setIsSaving(false);
  };

  // Build transform styles - separate zoom from image transforms
  // Zoom applies to the whole canvas (image + overlays), rotation/flip only to image
  const imageTransformStyle = {
    transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
    transition: 'transform 0.2s ease-out',
  };

  const canvasZoomStyle = {
    transform: `scale(${cropZoom})`,
    transformOrigin: 'center center',
  };

  // Calculate which parts of crop are outside image bounds
  const getOutOfBoundsAreas = () => {
    if (!cropArea || !imageBounds) return null;

    const areas: { x: number; y: number; width: number; height: number }[] = [];

    // Left overflow
    if (cropArea.x < imageBounds.x) {
      areas.push({
        x: cropArea.x,
        y: cropArea.y,
        width: imageBounds.x - cropArea.x,
        height: cropArea.height,
      });
    }

    // Right overflow
    if (cropArea.x + cropArea.width > imageBounds.x + imageBounds.width) {
      const overflowX = imageBounds.x + imageBounds.width;
      areas.push({
        x: overflowX,
        y: cropArea.y,
        width: cropArea.x + cropArea.width - overflowX,
        height: cropArea.height,
      });
    }

    // Top overflow
    if (cropArea.y < imageBounds.y) {
      areas.push({
        x: Math.max(cropArea.x, imageBounds.x),
        y: cropArea.y,
        width: Math.min(cropArea.x + cropArea.width, imageBounds.x + imageBounds.width) - Math.max(cropArea.x, imageBounds.x),
        height: imageBounds.y - cropArea.y,
      });
    }

    // Bottom overflow
    if (cropArea.y + cropArea.height > imageBounds.y + imageBounds.height) {
      const overflowY = imageBounds.y + imageBounds.height;
      areas.push({
        x: Math.max(cropArea.x, imageBounds.x),
        y: overflowY,
        width: Math.min(cropArea.x + cropArea.width, imageBounds.x + imageBounds.width) - Math.max(cropArea.x, imageBounds.x),
        height: cropArea.y + cropArea.height - overflowY,
      });
    }

    return areas.length > 0 ? areas : null;
  };

  const outOfBoundsAreas = getOutOfBoundsAreas();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[250] bg-void flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="shrink-0 h-14 flex items-center justify-between px-6 border-b border-border/50">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-text">Edit Image</span>
          {hasEdits && (
            <span className="text-xs text-gold px-2 py-0.5 rounded bg-gold-dim">Modified</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!hasEdits}
            isLoading={isSaving}
          >
            Save Copy
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="shrink-0 h-14 flex items-center justify-center gap-2 px-6 border-b border-border/50 bg-bg-2">
        {/* Undo / Revert controls */}
        <div className="flex items-center gap-1 px-2">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className={cn(
              "p-2 rounded-lg transition-colors",
              canUndo
                ? "hover:bg-bg-3 text-text-2 hover:text-text"
                : "text-text-3/30 cursor-not-allowed"
            )}
            title={`Undo (⌘Z) - ${history.length} step${history.length !== 1 ? 's' : ''}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
          </button>
          <button
            onClick={handleRevert}
            disabled={!canRevert}
            className={cn(
              "px-2 py-1.5 rounded-lg text-xs font-medium transition-colors",
              canRevert
                ? "hover:bg-err-dim text-err hover:text-err"
                : "text-text-3/30 cursor-not-allowed"
            )}
            title="Revert to original image"
          >
            Original
          </button>
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Rotate controls */}
        <div className="flex items-center gap-1 px-2">
          <button
            onClick={handleRotateLeft}
            className="p-2 rounded-lg hover:bg-bg-3 text-text-2 hover:text-text transition-colors"
            title="Rotate left 90°"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
          </button>
          <button
            onClick={handleRotateRight}
            className="p-2 rounded-lg hover:bg-bg-3 text-text-2 hover:text-text transition-colors"
            title="Rotate right 90°"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
            </svg>
          </button>
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Flip controls */}
        <div className="flex items-center gap-1 px-2">
          <button
            onClick={handleFlipH}
            className={cn(
              "p-2 rounded-lg transition-colors",
              flipH ? "bg-gold text-void" : "hover:bg-bg-3 text-text-2 hover:text-text"
            )}
            title="Flip horizontal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </button>
          <button
            onClick={handleFlipV}
            className={cn(
              "p-2 rounded-lg transition-colors",
              flipV ? "bg-gold text-void" : "hover:bg-bg-3 text-text-2 hover:text-text"
            )}
            title="Flip vertical"
          >
            <svg className="w-5 h-5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </button>
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Crop button - new icon */}
        <button
          onClick={() => isCropMode ? exitCropMode() : handleCropPresetSelect('1:1')}
          className={cn(
            "px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors",
            isCropMode ? "bg-blue text-void" : "hover:bg-bg-3 text-text-2 hover:text-text"
          )}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h4v4H4zM16 4h4v4h-4zM4 16h4v4H4zM16 16h4v4h-4z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8v8M8 4h8M20 8v8M8 20h8" />
          </svg>
          Crop
        </button>

        <div className="w-px h-6 bg-border" />

        {/* Grid button */}
        <div className="relative">
          <button
            onClick={() => setShowGridPicker(!showGridPicker)}
            className={cn(
              "px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors",
              isGridMode ? "bg-gold text-void" : "hover:bg-bg-3 text-text-2 hover:text-text"
            )}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            Grid
          </button>
          <AnimatePresence>
            {showGridPicker && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
              >
                <GridPicker
                  onSelect={handleGridSelect}
                  onClose={() => setShowGridPicker(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Reset */}
        <button
          onClick={handleReset}
          disabled={!hasEdits && !isGridMode && !isCropMode}
          className="px-3 py-2 rounded-lg text-sm text-text-3 hover:text-text hover:bg-bg-3
                   transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Reset
        </button>
      </div>

      {/* Crop presets bar */}
      {isCropMode && (
        <div className="shrink-0 py-3 px-6 bg-blue-dim border-b border-blue/30 flex items-center justify-center gap-2">
          {CROP_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleCropPresetSelect(preset.id)}
              className={cn(
                "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                cropPreset === preset.id
                  ? "bg-blue text-void"
                  : "bg-bg-3 text-text-2 hover:text-text hover:bg-bg-4"
              )}
            >
              {preset.label}
            </button>
          ))}

          <div className="w-px h-6 bg-blue/30 mx-2" />

          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCropZoom(z => Math.max(0.5, z - 0.25))}
              className="p-1.5 rounded bg-bg-3 text-text-2 hover:text-text hover:bg-bg-4 transition-colors"
              title="Zoom out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>
            <span className="text-xs text-text-2 w-12 text-center">{Math.round(cropZoom * 100)}%</span>
            <button
              onClick={() => setCropZoom(z => Math.min(3, z + 0.25))}
              className="p-1.5 rounded bg-bg-3 text-text-2 hover:text-text hover:bg-bg-4 transition-colors"
              title="Zoom in"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <div className="w-px h-6 bg-blue/30 mx-2" />

          <button
            onClick={applyCrop}
            disabled={!cropArea || isSaving}
            className="px-3 py-1.5 bg-blue text-void text-sm font-medium rounded hover:bg-blue/90 transition-colors disabled:opacity-50"
          >
            Apply Crop
          </button>

          <button
            onClick={exitCropMode}
            className="px-2 py-1 text-sm text-blue hover:text-blue/70 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Grid instruction */}
      {isGridMode && (
        <div className="shrink-0 py-2 px-6 bg-gold-dim text-center flex items-center justify-center gap-4">
          <span className="text-sm text-gold">
            {gridSize?.cols}×{gridSize?.rows} grid — Drag corners/edges to adjust
          </span>
          <button
            onClick={handleGridCrop}
            disabled={isSaving}
            className="px-3 py-1 bg-gold text-void text-sm font-medium rounded hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            {savingProgress ? `Saving ${savingProgress.current}/${savingProgress.total}...` : 'Crop All'}
          </button>
          <button
            onClick={exitGridMode}
            className="px-2 py-1 text-sm text-gold hover:text-gold/70 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Image area */}
      <div
        className={cn(
          "flex-1 min-h-0 flex items-center justify-center p-8 relative overflow-hidden",
          cropDragType === 'move' && "cursor-move",
          gridDragType === 'move' && "cursor-move"
        )}
        onMouseMove={(e) => {
          handleCropMouseMove(e);
          handleGridMouseMove(e);
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Zoomable canvas - contains image and all overlays */}
        <div
          ref={containerRef}
          className="relative flex items-center justify-center"
          style={canvasZoomStyle}
        >
          <img
            ref={imageRef}
            src={appliedCropPreview || imageUrl}
            alt=""
            style={imageTransformStyle}
            className="max-w-full max-h-full object-contain shadow-2xl select-none"
            draggable={false}
            onLoad={handleImageLoad}
          />

        {/* Crop overlay */}
        {isCropMode && cropArea && (
          <>
            {/* Dark overlay outside crop area */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Top */}
              <div
                className="absolute bg-void/80"
                style={{
                  left: 0,
                  top: 0,
                  right: 0,
                  height: Math.max(0, cropArea.y),
                }}
              />
              {/* Bottom */}
              <div
                className="absolute bg-void/80"
                style={{
                  left: 0,
                  top: cropArea.y + cropArea.height,
                  right: 0,
                  bottom: 0,
                }}
              />
              {/* Left */}
              <div
                className="absolute bg-void/80"
                style={{
                  left: 0,
                  top: Math.max(0, cropArea.y),
                  width: Math.max(0, cropArea.x),
                  height: cropArea.height,
                }}
              />
              {/* Right */}
              <div
                className="absolute bg-void/80"
                style={{
                  left: cropArea.x + cropArea.width,
                  top: Math.max(0, cropArea.y),
                  right: 0,
                  height: cropArea.height,
                }}
              />
            </div>

            {/* Green fill for out-of-bounds areas */}
            {outOfBoundsAreas && outOfBoundsAreas.map((area, i) => (
              <div
                key={i}
                className="absolute pointer-events-none"
                style={{
                  left: area.x,
                  top: area.y,
                  width: area.width,
                  height: area.height,
                  backgroundColor: '#00FF00',
                }}
              />
            ))}

            {/* Crop selection border - sharp edges */}
            <div
              className="absolute border-2 border-white pointer-events-none"
              style={{
                left: cropArea.x,
                top: cropArea.y,
                width: cropArea.width,
                height: cropArea.height,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
              }}
            >
              {/* Rule of thirds grid lines */}
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
            </div>

            {/* Corner handles - sharp squares */}
            <div
              className="absolute w-4 h-4 bg-white cursor-nw-resize"
              style={{ left: cropArea.x - 8, top: cropArea.y - 8 }}
              onMouseDown={(e) => handleCropMouseDown(e, 'nw')}
            />
            <div
              className="absolute w-4 h-4 bg-white cursor-ne-resize"
              style={{ left: cropArea.x + cropArea.width - 8, top: cropArea.y - 8 }}
              onMouseDown={(e) => handleCropMouseDown(e, 'ne')}
            />
            <div
              className="absolute w-4 h-4 bg-white cursor-sw-resize"
              style={{ left: cropArea.x - 8, top: cropArea.y + cropArea.height - 8 }}
              onMouseDown={(e) => handleCropMouseDown(e, 'sw')}
            />
            <div
              className="absolute w-4 h-4 bg-white cursor-se-resize"
              style={{ left: cropArea.x + cropArea.width - 8, top: cropArea.y + cropArea.height - 8 }}
              onMouseDown={(e) => handleCropMouseDown(e, 'se')}
            />

            {/* Move handle - center area */}
            <div
              className="absolute cursor-move"
              style={{
                left: cropArea.x + 16,
                top: cropArea.y + 16,
                width: cropArea.width - 32,
                height: cropArea.height - 32,
              }}
              onMouseDown={(e) => handleCropMouseDown(e, 'move')}
            />

            {/* Size indicator */}
            <div
              className="absolute px-2 py-1 bg-void/90 text-xs text-white whitespace-nowrap"
              style={{
                left: cropArea.x + cropArea.width / 2,
                top: cropArea.y + cropArea.height + 8,
                transform: 'translateX(-50%)',
              }}
            >
              {Math.round(cropArea.width)} × {Math.round(cropArea.height)}
              {outOfBoundsAreas && <span className="ml-2 text-[#00FF00]">+ outpaint</span>}
            </div>
          </>
        )}

        {/* Grid overlay */}
        {isGridMode && gridBounds && gridSize && (
          <div
            className="absolute"
            style={{
              left: gridBounds.x,
              top: gridBounds.y,
              width: gridBounds.width,
              height: gridBounds.height,
            }}
          >
            {/* Grid lines - vertical */}
            {Array.from({ length: gridSize.cols - 1 }).map((_, i) => (
              <div
                key={`v-${i}`}
                className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none"
                style={{
                  left: `${((i + 1) / gridSize.cols) * 100}%`,
                  boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                }}
              />
            ))}
            {/* Grid lines - horizontal */}
            {Array.from({ length: gridSize.rows - 1 }).map((_, i) => (
              <div
                key={`h-${i}`}
                className="absolute left-0 right-0 h-0.5 bg-white/80 pointer-events-none"
                style={{
                  top: `${((i + 1) / gridSize.rows) * 100}%`,
                  boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                }}
              />
            ))}

            {/* Cell numbers */}
            {Array.from({ length: gridSize.rows * gridSize.cols }).map((_, i) => {
              const row = Math.floor(i / gridSize.cols);
              const col = i % gridSize.cols;
              return (
                <div
                  key={`cell-${i}`}
                  className="absolute flex items-center justify-center pointer-events-none"
                  style={{
                    left: `${(col / gridSize.cols) * 100}%`,
                    top: `${(row / gridSize.rows) * 100}%`,
                    width: `${(1 / gridSize.cols) * 100}%`,
                    height: `${(1 / gridSize.rows) * 100}%`,
                  }}
                >
                  <span className="text-2xl font-bold text-white/50" style={{ textShadow: '0 0 8px rgba(0,0,0,0.8)' }}>
                    {i + 1}
                  </span>
                </div>
              );
            })}

            {/* Border */}
            <div className="absolute inset-0 border-2 border-gold pointer-events-none" style={{ boxShadow: '0 0 8px rgba(0,0,0,0.5)' }} />

            {/* Resize handles - corners */}
            <div
              className="absolute -left-2 -top-2 w-4 h-4 bg-gold cursor-nw-resize"
              onMouseDown={(e) => handleGridMouseDown(e, 'nw')}
            />
            <div
              className="absolute -right-2 -top-2 w-4 h-4 bg-gold cursor-ne-resize"
              onMouseDown={(e) => handleGridMouseDown(e, 'ne')}
            />
            <div
              className="absolute -left-2 -bottom-2 w-4 h-4 bg-gold cursor-sw-resize"
              onMouseDown={(e) => handleGridMouseDown(e, 'sw')}
            />
            <div
              className="absolute -right-2 -bottom-2 w-4 h-4 bg-gold cursor-se-resize"
              onMouseDown={(e) => handleGridMouseDown(e, 'se')}
            />

            {/* Resize handles - edges */}
            <div
              className="absolute left-1/2 -translate-x-1/2 -top-2 w-8 h-4 bg-gold cursor-n-resize"
              onMouseDown={(e) => handleGridMouseDown(e, 'n')}
            />
            <div
              className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-8 h-4 bg-gold cursor-s-resize"
              onMouseDown={(e) => handleGridMouseDown(e, 's')}
            />
            <div
              className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-8 bg-gold cursor-w-resize"
              onMouseDown={(e) => handleGridMouseDown(e, 'w')}
            />
            <div
              className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-8 bg-gold cursor-e-resize"
              onMouseDown={(e) => handleGridMouseDown(e, 'e')}
            />

            {/* Move handle - center */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-gold/30 border-2 border-gold rounded-full cursor-move flex items-center justify-center"
              onMouseDown={(e) => handleGridMouseDown(e, 'move')}
            >
              <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </div>
          </div>
        )}
        </div>{/* End zoomable canvas */}
      </div>

      {/* Info bar */}
      <div className="shrink-0 h-10 flex items-center justify-center gap-4 px-6 border-t border-border/50 bg-bg-2">
        {history.length > 0 && (
          <span className="text-xs text-text-3">
            {history.length} undo step{history.length !== 1 ? 's' : ''}
          </span>
        )}
        {appliedCropPreview && (
          <span className="text-xs text-blue px-2 py-0.5 bg-blue-dim rounded">Crop Applied</span>
        )}
        {rotation !== 0 && (
          <span className="text-xs text-text-3">Rotation: {rotation}°</span>
        )}
        {flipH && <span className="text-xs text-text-3">Flipped H</span>}
        {flipV && <span className="text-xs text-text-3">Flipped V</span>}
        {cropArea && (
          <span className="text-xs text-text-3">
            Crop: {Math.round(cropArea.width)} × {Math.round(cropArea.height)}
          </span>
        )}
        {isGridMode && gridSize && (
          <span className="text-xs text-gold">
            Grid: {gridSize.cols}×{gridSize.rows} ({gridSize.cols * gridSize.rows} cells)
          </span>
        )}
        {!hasEdits && !isGridMode && !isCropMode && (
          <span className="text-xs text-text-3">No changes</span>
        )}
      </div>
    </motion.div>
  );
}
