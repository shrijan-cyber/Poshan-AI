/**
 * Invokes a function immediately, then ignores calls until the wait period ends.
 *
 * @template {(...args: any[]) => any} T
 * @param {T} fn Function to invoke on the leading edge.
 * @param {number} [wait=1000] Minimum interval between invocations in milliseconds.
 * @param {(...args: any[]) => void} [onThrottle] Optional callback for ignored calls.
 * @returns {T & { cancel: () => void }} Throttled function with a cancel method.
 */
export default function throttle(fn, wait = 1000, onThrottle) {
  let timerId = null;

  const throttled = function (...args) {
    if (timerId !== null) {
      onThrottle?.apply(this, args);
      return;
    }

    fn.apply(this, args);
    timerId = setTimeout(() => {
      timerId = null;
    }, wait);
  };

  throttled.cancel = () => {
    if (timerId !== null) clearTimeout(timerId);
    timerId = null;
  };

  return throttled;
}
