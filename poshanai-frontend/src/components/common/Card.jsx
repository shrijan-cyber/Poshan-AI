export default function Card({ as: Element = 'div', padding = 'md', shadow = 'sm', rounded = 'xl', className = '', children, ...props }) {
  const paddingClasses = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' };
  const shadowClasses = { none: '', sm: 'shadow-sm', md: 'shadow-md', lg: 'shadow-lg' };
  const roundedClasses = { md: 'rounded-xl', lg: 'rounded-2xl', xl: 'rounded-3xl' };
  return (
    <Element className={`border border-slate-200 bg-white ${paddingClasses[padding] || paddingClasses.md} ${shadowClasses[shadow] || shadowClasses.sm} ${roundedClasses[rounded] || roundedClasses.xl} ${className}`} {...props}>
      {children}
    </Element>
  );
}
