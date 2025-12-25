import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../stores/store';
import { getImageUrl } from '../../api/server';
import { cn } from '../../utils/cn';

export function CompareBar() {
  const compareImages = useStore((s) => s.compareImages);
  const clearCompare = useStore((s) => s.clearCompare);
  const openCompare = useStore((s) => s.openCompare);
  const toggleCompare = useStore((s) => s.toggleCompare);

  if (compareImages.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40
                   bg-bg-2 border border-purple/30 rounded-xl shadow-2xl
                   flex items-center gap-3 px-4 py-3"
      >
        {/* Image thumbnails */}
        <div className="flex items-center gap-2">
          {compareImages.map((file, index) => (
            <div key={file} className="relative group">
              <img
                src={getImageUrl(file)}
                alt=""
                className="w-12 h-12 rounded-lg object-cover border-2 border-purple/50"
              />
              {/* Remove button */}
              <button
                onClick={() => toggleCompare(file)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full
                         bg-bg-3 border border-border text-text-3
                         opacity-0 group-hover:opacity-100 transition-opacity
                         flex items-center justify-center hover:bg-err hover:text-white hover:border-err"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {/* Index badge */}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full
                            bg-purple text-void text-[10px] font-bold
                            flex items-center justify-center">
                {index + 1}
              </div>
            </div>
          ))}

          {/* Add more hint */}
          {compareImages.length < 4 && (
            <div className="w-12 h-12 rounded-lg border-2 border-dashed border-border
                          flex items-center justify-center text-text-3">
              <span className="text-xs">+</span>
            </div>
          )}
        </div>

        <div className="w-px h-10 bg-border" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={openCompare}
            disabled={compareImages.length < 2}
            className={cn(
              'px-4 py-2 rounded-lg font-medium text-sm transition-all',
              'flex items-center gap-2',
              compareImages.length >= 2
                ? 'bg-purple text-void hover:bg-purple/90'
                : 'bg-bg-3 text-text-3 cursor-not-allowed'
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Compare {compareImages.length}
          </button>

          <button
            onClick={clearCompare}
            className="p-2 rounded-lg text-text-3 hover:text-text hover:bg-bg-3 transition-colors"
            title="Clear selection"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
