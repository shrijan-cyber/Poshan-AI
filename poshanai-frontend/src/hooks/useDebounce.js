import { useEffect, useState } from 'react';

/**
 * Returns the latest value after it has remained unchanged for the delay.
 *
 * @template T
 * @param {T} value Value to debounce.
 * @param {number} [delay=500] Delay in milliseconds.
 * @returns {T} Debounced value.
 *
 * @example
 * const debouncedQuery = useDebounce(query, 400);
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timerId = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timerId);
  }, [value, delay]);

  return debouncedValue;
}
