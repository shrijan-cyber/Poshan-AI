const severityStyles = {
  mild: 'bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300',
  moderate:
    'bg-orange-100 text-orange-800 ring-orange-600/20 dark:bg-orange-950 dark:text-orange-300',
  severe: 'bg-red-100 text-red-800 ring-red-600/20 dark:bg-red-950 dark:text-red-300',
};

export default function Badge({ severity = 'mild', children, className = '', ...props }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${severityStyles[severity] ?? severityStyles.mild} ${className}`}
      {...props}
    >
      {children ?? severity}
    </span>
  );
}
