const severityClasses = {
  mild: 'bg-emerald-100 text-emerald-900',
  moderate: 'bg-amber-100 text-amber-950',
  severe: 'bg-red-100 text-red-900',
};

export default function Badge({ severity, children, className = '', ...props }) {
  const label = children ?? severity;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${severityClasses[severity] || 'bg-slate-100 text-slate-800'} ${className}`} {...props}>
      {label}
    </span>
  );
}
