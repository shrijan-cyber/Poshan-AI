export default function Loader({
  variant = 'spinner',
  size = 'md',
  className = '',
  label = 'Loading',
}) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };
  if (variant === 'skeleton')
    return (
      <div aria-hidden="true" className={`animate-pulse space-y-3 ${className}`}>
        <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-5/6 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block animate-spin rounded-full border-2 border-emerald-700 border-r-transparent ${sizes[size] ?? sizes.md} ${className}`}
    />
  );
}
