import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContext = createContext(null);
const styles = { success: 'border-emerald-500', error: 'border-red-500', info: 'border-blue-500' };

export function ToastProvider({ children, duration = 4000 }) {
  const [items, setItems] = useState([]);
  const dismiss = useCallback(
    (id) => setItems((current) => current.filter((item) => item.id !== id)),
    [],
  );
  const toast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setItems((current) => [...current, { id, message, type }]);
    return id;
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
        aria-live="polite"
        aria-relevant="additions"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <ToastItem key={item.id} {...item} duration={duration} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ id, message, type, duration, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);
  return (
    <motion.div
      role={type === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className={`flex items-start justify-between gap-3 rounded-lg border-l-4 bg-white p-4 shadow-lg dark:bg-slate-900 ${styles[type] ?? styles.info}`}
    >
      <span className="text-sm">{message}</span>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
      >
        ×
      </button>
    </motion.div>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast must be used inside ToastProvider');
  return toast;
}

export default function Toast({ message, type = 'info', onDismiss, duration = 4000 }) {
  const id = 'standalone-toast';
  return (
    <ToastItem
      id={id}
      message={message}
      type={type}
      duration={duration}
      onDismiss={() => onDismiss?.()}
    />
  );
}
