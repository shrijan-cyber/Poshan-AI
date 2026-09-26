export default function Loader({ variant = 'spinner', label = 'Loading', className = '', rows = 3 }) {
  if (variant === 'skeleton') {
    return (
      <div className={`animate-pulse space-y-3 ${className}`} role="status" aria-label={label}>
        <span className="sr-only">{label}</span>
        {Array.from({ length: Math.max(1, rows) }, (_, index) => (
          <div key={index} className={`h-4 rounded bg-slate-200 ${index === 0 ? 'w-2/3' : 'w-full'}`} aria-hidden="true" />
        ))}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 text-sm text-slate-600 ${className}`} role="status" aria-label={label}>
      <span className="size-5 animate-spin rounded-full border-2 border-emerald-700 border-r-transparent" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
