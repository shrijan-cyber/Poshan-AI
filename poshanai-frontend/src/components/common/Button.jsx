import { forwardRef } from 'react';
import { motion } from 'framer-motion';

const variantClasses = {
  primary: 'bg-leaf text-white hover:bg-emerald-800 focus-visible:ring-leaf',
  secondary: 'border border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50 focus-visible:ring-emerald-600',
  danger: 'bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-700',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-500',
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
  disabled = false,
  className = '',
  children,
  type = 'button',
  ...props
}, ref) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant] || variantClasses.primary} ${sizeClasses[size] || sizeClasses.md} ${className}`}
      {...props}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />}
      {children}
    </motion.button>
  );
});

export default Button;
