import { forwardRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const variantClasses = {
  primary: 'bg-leaf text-white hover:bg-leaf-dark focus-visible:ring-leaf',
  secondary: 'border border-emerald-200 bg-white text-leaf hover:bg-emerald-50 focus-visible:ring-emerald-600 dark:border-emerald-900 dark:bg-slate-800 dark:text-emerald-200 dark:hover:bg-slate-700',
  outline: 'border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-500 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800',
  danger: 'bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-700',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-500 dark:text-slate-200 dark:hover:bg-slate-800',
};

const sizeClasses = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm sm:text-base',
  lg: 'min-h-12 px-6 text-base',
};

const Button = forwardRef(function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText = 'Loading',
  disabled = false,
  className = '',
  children,
  type = 'button',
  ...props
}, ref) {
  const shouldReduceMotion = useReducedMotion();
  const isDisabled = disabled || loading;

  return (
    <motion.button
      {...props}
      ref={ref}
      type={type}
      whileHover={!isDisabled && !shouldReduceMotion ? { y: -1, scale: 1.01 } : undefined}
      whileTap={!isDisabled && !shouldReduceMotion ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant] || variantClasses.primary} ${sizeClasses[size] || sizeClasses.md} ${className}`}
    >
      {loading && (
        <>
          <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
          <span className="sr-only">{loadingText}</span>
        </>
      )}
      {children}
    </motion.button>
  );
});

export default Button;
