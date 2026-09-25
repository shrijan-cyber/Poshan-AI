import { useId } from 'react';

export default function Input({ label, error, helperText, icon, id, className = '', ...props }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-100"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"
          >
            {icon}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error || helperText ? messageId : undefined}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-leaf focus:ring-2 focus:ring-emerald-100 dark:bg-slate-900 dark:text-white dark:focus:ring-emerald-900 ${icon ? 'pl-10' : ''} ${error ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'} ${className}`}
          {...props}
        />
      </div>
      {(error || helperText) && (
        <p
          id={messageId}
          className={`mt-1.5 text-sm ${error ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}
          role={error ? 'alert' : undefined}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
}
