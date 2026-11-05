import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface NativeBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export const NativeBottomSheet: React.FC<NativeBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxHeight = 'max-h-[88vh]',
}) => {
  // Lock body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pb-[max(0px,env(safe-area-inset-bottom,0px))]">
          {/* Backdrop with frosted blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/65 backdrop-blur-md cursor-pointer modal-backdrop"
          />

          {/* Bottom Sheet Modal Container */}
          <motion.div
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={`modal-surface relative w-full max-w-lg bg-white rounded-t-[28px] sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col ${maxHeight} z-10`}
          >
            {/* Native Pull Grabber */}
            <div 
              onClick={onClose}
              className="w-full pt-3 pb-1 cursor-pointer flex justify-center items-center select-none"
            >
              <div className="w-10 h-1.2 rounded-full bg-zinc-300 hover:bg-zinc-400 transition-colors" />
            </div>

            {/* Header */}
            {(title || subtitle) && (
              <div className="px-5 pb-3 pt-1 flex items-start justify-between border-b border-zinc-100">
                <div>
                  {title && <h3 className="text-base font-bold text-zinc-900 tracking-tight">{title}</h3>}
                  {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 -mr-1.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                  aria-label="Close sheet"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
