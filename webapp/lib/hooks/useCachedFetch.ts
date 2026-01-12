'use client';

import { useState, useEffect, useCallback } from 'react';
import { cache } from '@/lib/cache';

interface UseCachedFetchOptions {
  cacheTTL?: number; // Cache time-to-live in milliseconds
  refreshInterval?: number; // Auto-refresh interval in milliseconds
  skip?: boolean; // Skip fetching
}

export function useCachedFetch<T>(
  url: string,
  options: UseCachedFetchOptions = {}
) {
  const { cacheTTL = 5000, refreshInterval, skip = false } = options;

  const [data, setData] = useState<T | null>(() => {
    // Try to get from cache on mount
    return cache.get<T>(url, cacheTTL);
  });
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string>('');

  const fetchData = useCallback(async () => {
    if (skip) return;

    // Check cache first
    const cached = cache.get<T>(url, cacheTTL);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);

      const result = await res.json();

      // Store in cache
      cache.set(url, result);
      setData(result);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [url, cacheTTL, skip]);

  useEffect(() => {
    fetchData();

    // Set up auto-refresh if specified
    if (refreshInterval && !skip) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval, skip]);

  const refetch = useCallback(() => {
    cache.clear(url); // Clear cache for this URL
    fetchData();
  }, [url, fetchData]);

  return { data, loading, error, refetch };
}
