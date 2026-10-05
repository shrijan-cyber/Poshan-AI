import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import client, { payloadFrom } from '../api/client.js';
import memoryCache from '../utils/memoryCache.js';

const DEFAULT_TTL = 5 * 60 * 1000;
const CACHEABLE_PATHS = new Set(['/foods', '/dashboard/stats']);

function serialize(value) {
  if (Array.isArray(value)) return `[${value.map(serialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${serialize(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function getRequestUrl(url) {
  if (!url) return null;
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const baseUrl = new URL(client.defaults.baseURL || '/', origin);
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) return new URL(url);
  const basePath = `${baseUrl.pathname.replace(/\/+$/, '')}/`;
  return new URL(url.replace(/^\/+/, ''), `${baseUrl.origin}${basePath}`);
}

function canCacheUrl(requestUrl) {
  if (!requestUrl) return false;
  const baseUrl = getRequestUrl('');
  if (!baseUrl || requestUrl.origin !== baseUrl.origin) return false;
  const basePath = baseUrl.pathname.replace(/\/+$/, '');
  const path = requestUrl.pathname.slice(basePath.length).replace(/^\/+|\/$/g, '');
  return CACHEABLE_PATHS.has(path);
}

function canCacheResponse(requestUrl, data) {
  if (!canCacheUrl(requestUrl)) return false;
  if (requestUrl.pathname.endsWith('/foods')) return true;
  const stats = data?.stats ?? data;
  return (
    stats !== null &&
    typeof stats === 'object' &&
    !Array.isArray(stats) &&
    Object.values(stats).every((value) => typeof value === 'number' && Number.isFinite(value))
  );
}

function createCacheKey(requestUrl, paramsKey) {
  return `${requestUrl?.toString() ?? ''}::${paramsKey}`;
}

/**
 * Fetches API data and revalidates cached, non-sensitive responses in the background.
 *
 * Only public IFCT food data and aggregate dashboard statistics are cached. Do not
 * return profile fields, report contents, nutrient values, or other health data from
 * these endpoints.
 *
 * @param {string} url API endpoint.
 * @param {{ ttl?: number, enabled?: boolean, params?: object }} [options]
 * @returns {{ data: unknown, isLoading: boolean, error: Error|null, refetch: Function, invalidateCache: Function }}
 */
export function useCachedFetch(url, { ttl = DEFAULT_TTL, enabled = true, params } = {}) {
  const paramsKey = useMemo(() => serialize(params ?? {}), [params]);
  const requestUrl = useMemo(() => getRequestUrl(url), [url]);
  const cacheKey = useMemo(() => createCacheKey(requestUrl, paramsKey), [requestUrl, paramsKey]);
  const shouldCache = useMemo(() => canCacheUrl(requestUrl), [requestUrl]);
  const paramsRef = useRef(params);
  const controllerRef = useRef(null);
  const requestIdRef = useRef(0);
  paramsRef.current = params;

  const [state, setState] = useState({
    data: undefined,
    isLoading: Boolean(enabled && url),
    error: null,
  });

  const fetchData = useCallback(async (signal, { keepStale = false } = {}) => {
    if (!url || !enabled) return undefined;

    const requestId = ++requestIdRef.current;
    const cachedData = shouldCache ? memoryCache.get(cacheKey) : undefined;
    if (cachedData !== undefined) {
      setState({ data: cachedData, isLoading: false, error: null });
    } else if (!keepStale) {
      setState((current) => ({ ...current, data: undefined, isLoading: true, error: null }));
    } else {
      setState((current) => ({ ...current, isLoading: true, error: null }));
    }

    try {
      const response = await client.get(url, { params: paramsRef.current, signal });
      const data = payloadFrom(response);
      if (requestId === requestIdRef.current) {
        if (shouldCache && canCacheResponse(requestUrl, data)) {
          memoryCache.set(cacheKey, data, ttl);
        }
        setState({ data, isLoading: false, error: null });
      }
      return data;
    } catch (error) {
      if (requestId === requestIdRef.current && error.name !== 'CanceledError') {
        setState((current) => ({
          ...current,
          isLoading: false,
          error,
        }));
      }
      if (error.name !== 'CanceledError') throw error;
      return undefined;
    }
  }, [cacheKey, enabled, requestUrl, shouldCache, ttl, url]);

  useEffect(() => {
    if (!url || !enabled) {
      setState((current) => ({ ...current, isLoading: false, error: null }));
      return undefined;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    fetchData(controller.signal).catch(() => {});
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
      requestIdRef.current += 1;
    };
  }, [enabled, fetchData, url]);

  const refetch = useCallback(async () => {
    if (!url || !enabled) return undefined;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return fetchData(controller.signal, { keepStale: true });
  }, [enabled, fetchData, url]);

  const invalidateCache = useCallback(() => {
    memoryCache.delete(cacheKey);
    setState((current) => ({ ...current, data: undefined, error: null }));
  }, [cacheKey]);

  return { ...state, refetch, invalidateCache };
}
