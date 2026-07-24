import { useState, useEffect, useCallback } from "react";
import { get } from "../api/client";
import type { ApiResponse } from "../types";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string;
}

export function useFetch<T>(url: string) {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: "" });

  const fetch = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const res = await get<ApiResponse<T>>(url);
      setState({ data: res.data, loading: false, error: "" });
    } catch (err) {
      setState({ data: null, loading: false, error: err instanceof Error ? err.message : "Request failed" });
    }
  }, [url]);

  useEffect(() => { fetch(); }, [fetch]);

  return { ...state, refetch: fetch };
}
