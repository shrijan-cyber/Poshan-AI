import { forwardRef, useId } from 'react';

const Input = forwardRef(function Input({
  id,
  label,
  error,
  helperText,
  className = '',
  type = 'text',
  ...props
}, ref) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [helperText ? hintId : null, error ? errorId : null, props['aria-describedby']]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="w-full">
      {label && <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-800">{label}</label>}
      <input
        {...props}
        ref={ref}
        id={inputId}
        type={type}
        aria-invalid={Boolean(error) || props['aria-invalid'] || undefined}
        aria-describedby={describedBy}
        className={`min-h-11 w-full rounded-xl border bg-white px-3 py-2.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-1 ${error ? 'border-red-600 focus-visible:ring-red-600' : 'border-slate-300'} ${className}`}
      />
      {helperText && <p id={hintId} className="mt-1.5 text-sm text-slate-600">{helperText}</p>}
      {error && <p id={errorId} className="mt-1.5 text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
});

export default Input;
