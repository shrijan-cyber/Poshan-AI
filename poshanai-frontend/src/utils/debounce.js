/**
 * Delays invoking a function until the wait period has passed without another call.
 *
 * @template {(...args: any[]) => any} T
 * @param {T} fn Function to invoke after the calls pause.
 * @param {number} [delay=500] Delay in milliseconds.
 * @returns {T & { cancel: () => void }} Debounced function with a cancel method.
 */
export default function debounce(fn, delay = 500) {
  let timerId = null;

  const debounced = function (...args) {
    const context = this;
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(() => {
      timerId = null;
      fn.apply(context, args);
    }, delay);
  };

  debounced.cancel = () => {
    if (timerId !== null) clearTimeout(timerId);
    timerId = null;
  };

  return debounced;
}
