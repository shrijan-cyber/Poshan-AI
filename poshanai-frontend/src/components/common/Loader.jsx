import Skeleton from './Skeleton.jsx';

export default function Loader({
  variant = 'spinner',
  size = 'md',
  className = '',
  label = 'Loading',
  width = 'full',
  height = '4',
}) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };
  if (variant === 'skeleton') {
    return (
      <div role="status" aria-label={label} className={`space-y-3 ${className}`}>
        <Skeleton width={width} height={height} />
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div role="status" aria-label={label} className={`rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 ${className}`}>
        <Skeleton width="half" height="5" />
        <div className="mt-5 space-y-3">
          <Skeleton height="4" />
          <Skeleton width="twoThirds" height="4" />
        </div>
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div role="status" aria-label={label} className={`flex min-h-[50vh] flex-col items-center justify-center gap-4 ${className}`}>
        <span aria-hidden="true" className={`inline-block animate-spin rounded-full border-2 border-emerald-700 border-r-transparent motion-reduce:animate-none ${sizes[size] ?? sizes.md}`} />
        <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      </div>
    );
  }

  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block animate-spin rounded-full border-2 border-emerald-700 border-r-transparent motion-reduce:animate-none ${sizes[size] ?? sizes.md} ${className}`}
    />
  );
}
