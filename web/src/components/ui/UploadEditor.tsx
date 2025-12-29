import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../stores/store';
import { cn } from '../../utils/cn';
import { saveImage, saveGridImage, fetchGeneratedImages } from '../../api/server';
import { ImageEditor } from '../lightbox/ImageEditor';

interface UploadEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UploadEditor({ isOpen, onClose }: UploadEditorProps) {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addToast = useStore((s) => s.addToast);
  const setGeneratedImages = useStore((s) => s.setGeneratedImages);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast({ message: 'Please select an image file', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      setImageDataUrl(dataUrl);
    } catch (err) {
      console.error('Failed to load image:', err);
      addToast({ message: 'Failed to load image', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageItem = Array.from(items).find(item => item.type.startsWith('image/'));
    if (!imageItem) return;

    e.preventDefault();
    const file = imageItem.getAsFile();
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveEdited = async (editedDataUrl: string) => {
    try {
      await saveImage({
        image: editedDataUrl,
        prompt: 'uploaded',
        model: 'upload',
      });

      // Refresh generated images list
      const images = await fetchGeneratedImages();
      setGeneratedImages(images);

      setImageDataUrl(null);
      onClose();
      addToast({ message: 'Image saved', type: 'success' });
    } catch (e) {
      addToast({ message: 'Failed to save image', type: 'error' });
    }
  };

  const handleGridSave = async (images: { dataUrl: string; index: number }[]) => {
    try {
      const baseName = `upload-${Date.now()}`;

      for (const img of images) {
        await saveGridImage({
          image: img.dataUrl,
          base_filename: baseName,
          index: img.index,
        });
      }

      // Refresh generated images list
      const generatedImages = await fetchGeneratedImages();
      setGeneratedImages(generatedImages);

      setImageDataUrl(null);
      onClose();
      addToast({ message: `Saved ${images.length} images`, type: 'success' });
    } catch (e) {
      addToast({ message: 'Failed to save grid images', type: 'error' });
    }
  };

  const handleCancel = () => {
    if (imageDataUrl) {
      setImageDataUrl(null);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  // If we have an image, show the editor
  if (imageDataUrl) {
    return (
      <ImageEditor
        imageUrl={imageDataUrl}
        onSave={handleSaveEdited}
        onCancel={handleCancel}
        onGridSave={handleGridSave}
      />
    );
  }

  // Otherwise show upload modal
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-void/90 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          tabIndex={0}
          className={cn(
            'bg-bg-2 border rounded-2xl shadow-2xl overflow-hidden max-w-md w-full',
            'focus:outline-none focus:ring-2 focus:ring-gold/50',
            isDragOver ? 'border-gold ring-2 ring-gold/30' : 'border-border'
          )}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-base font-medium text-text">Upload & Edit</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-3 hover:text-text hover:bg-bg-3 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Drop zone */}
          <div className="p-6">
            <div
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
                isDragOver
                  ? 'border-gold bg-gold/5'
                  : 'border-border hover:border-text-3 hover:bg-bg-3/30'
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              {isLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                  <p className="text-sm text-text-2">Loading image...</p>
                </div>
              ) : (
                <>
                  <div className={cn(
                    'w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center',
                    isDragOver ? 'bg-gold/20' : 'bg-bg-3'
                  )}>
                    <svg className={cn(
                      'w-7 h-7',
                      isDragOver ? 'text-gold' : 'text-text-3'
                    )} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-text mb-1">
                    {isDragOver ? 'Drop to upload' : 'Drop image here or click to browse'}
                  </p>
                  <p className="text-xs text-text-3">
                    Or paste from clipboard (Cmd+V)
                  </p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>

          {/* Footer hint */}
          <div className="px-5 py-3 bg-bg-3/30 border-t border-border">
            <p className="text-xs text-text-3 text-center">
              Crop, rotate, flip, or split into grid - then save to library
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
