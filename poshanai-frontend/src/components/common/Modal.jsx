import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ open, onClose, title, ariaLabel = 'Dialog', children, className = '', closeOnBackdrop = true }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll(FOCUSABLE_SELECTOR);
    (focusable?.[0] || dialog)?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
      }
      if (event.key !== 'Tab') return;
      const elements = [...(dialog?.querySelectorAll(FOCUSABLE_SELECTOR) || [])];
      if (!elements.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [onClose, open]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
          }}
        >
          <motion.section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : ariaLabel}
            tabIndex={-1}
            initial={{ opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            className={`max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl focus:outline-none sm:max-w-lg sm:rounded-3xl sm:p-6 ${className}`}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              {title && <h2 id={titleId} className="text-lg font-semibold text-slate-900">{title}</h2>}
              <button type="button" onClick={onClose} className="ml-auto rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf" aria-label="Close dialog">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            {children}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
