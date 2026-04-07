import { useState, useEffect, useCallback, useRef } from "react";

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  enabled: boolean = true
): {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
  lastUpdated: Date | null;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetcherRef = useRef(fetcher);
  const lastJsonRef = useRef<string>("");
  const initialFetchDone = useRef(false);
  fetcherRef.current = fetcher;

  const doFetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      // Strip volatile fields (e.g. next_page_token) from comparison
      const json = JSON.stringify(result, (key, value) =>
        key === "next_page_token" ? undefined : value
      );
      // Only update state if data actually changed
      if (json !== lastJsonRef.current) {
        lastJsonRef.current = json;
        setData(result);
        setLastUpdated(new Date());
      }
      setError((prev) => prev === null ? prev : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!initialFetchDone.current) {
        initialFetchDone.current = true;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    initialFetchDone.current = false;
    setLoading(true);
    doFetch();
    const timer = setInterval(doFetch, intervalMs);
    return () => clearInterval(timer);
  }, [doFetch, intervalMs, enabled]);

  return { data, error, loading, refresh: doFetch, lastUpdated };
}
