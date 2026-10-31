export default function Card({
  as: Component = 'div',
  padding = 'md',
  shadow = 'sm',
  rounded = 'md',
  className = '',
  children,
  ...props
}) {
  const paddingStyles = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };
  const shadowStyles = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md shadow-forest/5',
    lg: 'shadow-lg shadow-forest/10',
  };
  const roundedStyles = { none: 'rounded-none', md: 'rounded-xl', lg: 'rounded-2xl', full: 'rounded-full' };
  return (
    <Component
      className={`border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${paddingStyles[padding] ?? paddingStyles.md} ${shadowStyles[shadow] ?? shadowStyles.sm} ${roundedStyles[rounded] ?? roundedStyles.md} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
