const widthClasses = {
  auto: 'w-auto',
  full: 'w-full',
  half: 'w-1/2',
  third: 'w-1/3',
  twoThirds: 'w-2/3',
  quarter: 'w-1/4',
  threeQuarters: 'w-3/4',
  16: 'w-16',
  24: 'w-24',
  32: 'w-32',
  40: 'w-40',
  48: 'w-48',
  64: 'w-64',
  '200px': 'w-[200px]',
};

const heightClasses = {
  2: 'h-2',
  3: 'h-3',
  4: 'h-4',
  5: 'h-5',
  6: 'h-6',
  8: 'h-8',
  10: 'h-10',
  12: 'h-12',
  16: 'h-16',
  20: 'h-20',
  24: 'h-24',
  32: 'h-32',
  40: 'h-40',
  48: 'h-48',
  '200px': 'h-[200px]',
};

const roundedClasses = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
};

/**
 * Shimmer placeholder. Width and height use Tailwind size tokens; use className
 * for additional responsive sizing.
 *
 * @param {{ width?: string, height?: string, rounded?: string, className?: string }} props
 */
export default function Skeleton({
  width = 'full',
  height = '4',
  rounded = 'md',
  className = '',
}) {
  return (
    <div
      aria-hidden="true"
      className={`shimmer ${widthClasses[width] || widthClasses.full} ${heightClasses[height] || heightClasses[4]} ${roundedClasses[rounded] || roundedClasses.md} ${className}`}
    />
  );
}
