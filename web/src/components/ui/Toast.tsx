import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../stores/store';
import { cn } from '../../utils/cn';

export function ToastContainer() {
  const toasts = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);

  return (
    // Mobile: top center, Desktop: bottom right
    // On mobile, toasts at top avoid overlap with GeneratorIsland at bottom
    <div className={cn(
      'fixed z-[100] flex flex-col gap-2',
      // Mobile: top center, safe area for notch
      'top-4 left-4 right-4 items-center pt-[env(safe-area-inset-top)]',
      // Tablet+: bottom right corner
      'sm:top-auto sm:left-auto sm:right-6 sm:bottom-6 sm:items-end sm:pt-0'
    )}>
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={cn(
              'px-4 py-3 rounded-lg shadow-lg backdrop-blur-md',
              'flex items-center gap-3',
              // Responsive width: full on mobile, constrained on tablet+
              'w-full sm:w-auto sm:min-w-[280px] sm:max-w-[400px]',
              'border cursor-pointer',
              // Touch-friendly minimum height
              'min-h-[44px]',
              toast.type === 'success' && 'bg-ok-dim/80 border-ok/30 text-ok',
              toast.type === 'error' && 'bg-err-dim/80 border-err/30 text-err',
              toast.type === 'info' && 'bg-blue-dim/80 border-blue/30 text-blue'
            )}
            onClick={() => removeToast(toast.id)}
          >
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
