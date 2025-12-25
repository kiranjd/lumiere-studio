import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getImageUrl } from '../../api/server';

interface InspirationStripProps {
  generatedImages: Array<{ file: string }>;
  libraryImages: Array<{ file: string }>;
}

const SLOT_COUNT = 5; // Match masonry grid columns

export function InspirationStrip({ generatedImages, libraryImages }: InspirationStripProps) {
  // Combine all images
  const allImages = [...generatedImages, ...libraryImages].map(img => img.file);

  // 5 slots to fill the row
  const [slots, setSlots] = useState<string[]>([]);
  const [nextSlotToChange, setNextSlotToChange] = useState(0);

  // Shuffle array helper
  const shuffle = useCallback((arr: string[]) => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  // Get random image not in current slots
  const getRandomImage = useCallback((exclude: string[]) => {
    const available = allImages.filter(img => !exclude.includes(img));
    if (available.length === 0) return allImages[Math.floor(Math.random() * allImages.length)];
    return available[Math.floor(Math.random() * available.length)];
  }, [allImages]);

  // Initialize slots
  useEffect(() => {
    if (allImages.length > 0 && slots.length === 0) {
      const shuffled = shuffle(allImages);
      setSlots(shuffled.slice(0, SLOT_COUNT));
    }
  }, [allImages, slots.length, shuffle]);

  // Rotate one image at a time
  useEffect(() => {
    if (allImages.length < SLOT_COUNT + 1) return; // Need enough images to rotate

    const interval = setInterval(() => {
      setSlots(prev => {
        const newSlots = [...prev];
        const newImage = getRandomImage(newSlots);
        newSlots[nextSlotToChange] = newImage;
        return newSlots;
      });
      setNextSlotToChange(prev => (prev + 1) % SLOT_COUNT);
    }, 2500); // Change one image every 2.5 seconds

    return () => clearInterval(interval);
  }, [allImages.length, nextSlotToChange, getRandomImage]);

  if (allImages.length === 0) return null;

  return (
    <div className="mb-8 pb-6 relative">
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 -m-4 rounded-2xl opacity-60"
        style={{
          background: 'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(30,30,30,0) 40%, rgba(212,175,55,0.05) 70%, rgba(30,30,30,0) 100%)',
          backgroundSize: '400% 400%',
          animation: 'gradient-shift 12s ease infinite',
        }}
      />

      <div className="relative grid grid-cols-5 gap-2">
        {slots.map((file, index) => (
          <div
            key={index}
            className="relative overflow-hidden rounded-lg"
          >
            <AnimatePresence mode="popLayout">
              <motion.div
                key={file}
                className="relative"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 1, ease: 'easeInOut' }}
              >
                <img
                  src={getImageUrl(file)}
                  alt=""
                  className="w-full h-auto rounded-lg ring-2 ring-gold/40 ring-offset-2 ring-offset-bg"
                />
              </motion.div>
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Bottom fade divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
    </div>
  );
}
