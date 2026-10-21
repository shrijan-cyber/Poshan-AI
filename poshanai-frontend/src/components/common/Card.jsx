export default function Card({
  as: Component = 'div',
  padding = 'md',
  shadow = 'sm',
  rounded = 'lg',
  className = '',
  children,
  ...props
}) {
  const paddingStyles = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };
  const shadowStyles = { none: '', sm: 'shadow-sm', md: 'shadow-md', lg: 'shadow-lg' };
  const roundedStyles = { md: 'rounded-xl', lg: 'rounded-2xl', full: 'rounded-3xl' };
  return (
    <Component
      className={`app-retro-card border-2 border-black bg-white ${paddingStyles[padding] ?? paddingStyles.md} ${shadowStyles[shadow] ?? shadowStyles.sm} ${roundedStyles[rounded] ?? roundedStyles.lg} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
