import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const toastClasses = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-950',
  error: 'border-red-300 bg-red-50 text-red-950',
  info: 'border-sky-300 bg-sky-50 text-sky-950',
};

export default function Toast({ type = 'info', message, duration = 4000, onDismiss, className = '' }) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
  }, [message]);

  useEffect(() => {
    if (!visible || !message || duration <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [duration, message, onDismiss, visible]);

  return (
    <AnimatePresence>
      {visible && message && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          role={type === 'error' ? 'alert' : 'status'}
          aria-live={type === 'error' ? 'assertive' : 'polite'}
          className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-sm ${toastClasses[type] || toastClasses.info} ${className}`}
        >
          <span>{message}</span>
          {onDismiss && (
              <button type="button" onClick={() => { setVisible(false); onDismiss?.(); }} className="rounded p-1 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current" aria-label="Dismiss notification">
              <span aria-hidden="true">×</span>
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
