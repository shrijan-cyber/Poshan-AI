import { useEffect, useMemo, useRef } from 'react';
import throttle from '../utils/throttle.js';

/**
 * Returns a stable, leading-edge throttled callback.
 *
 * @template {(...args: any[]) => any} T
 * @param {T} callback Callback to throttle.
 * @param {number} [wait=1000] Minimum interval between invocations in milliseconds.
 * @returns {T} Throttled callback.
 *
 * @example
 * const submitProfile = useThrottle(handleSubmit(onSubmit), 1000);
 */
export function useThrottle(callback, wait = 1000) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const throttledCallback = useMemo(
    () => throttle((...args) => callbackRef.current(...args), wait),
    [wait],
  );

  useEffect(() => () => throttledCallback.cancel(), [throttledCallback]);

  return throttledCallback;
}
