import { Button as RetroButton } from 'pixel-retroui';

const variants = {
  primary: { bg: '#1E5631', textColor: '#FFFFFF' },
  secondary: { bg: '#FFFFFF', textColor: '#000000' },
  danger: { bg: '#B91C1C', textColor: '#FFFFFF' },
  ghost: { bg: '#F8F7F1', textColor: '#27362D' },
};
const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  as: Component,
  className = '',
  children,
  type = 'button',
  ...props
}) {
  const colors = variants[variant] ?? variants.primary;
  const buttonContent = (
    <>
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </>
  );
  const sharedClassName = `mx-0 my-0 inline-flex items-center justify-center gap-2 font-minecraft font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${sizes[size] ?? sizes.md} ${className}`;

  if (Component) {
    return (
      <Component
        className={`app-retro-button ${sharedClassName}`}
        style={{
          '--retro-button-bg': colors.bg,
          '--retro-button-text': colors.textColor,
        }}
        aria-busy={loading || undefined}
        {...props}
      >
        {buttonContent}
      </Component>
    );
  }

  return (
    <RetroButton
      bg={colors.bg}
      textColor={colors.textColor}
      borderColor="#000000"
      shadow="#000000"
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${sharedClassName} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
      {...props}
    >
      {buttonContent}
    </RetroButton>
  );
}
