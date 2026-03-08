import { useState, useEffect, useRef, useCallback } from "react";
import type { LiveResources } from "../lib/hf-types";

async function fetchLiveResources(): Promise<LiveResources> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<LiveResources>("get_live_resources");
  } catch {
    // Browser fallback with realistic-looking data
    const base = {
      cpu_percent: 15 + Math.random() * 30,
      cpu_per_core: Array.from(
        { length: navigator.hardwareConcurrency || 4 },
        () => Math.random() * 60,
      ),
      ram_used_gb: 6 + Math.random() * 4,
      ram_total_gb: 16,
      gpu_percent: null,
      gpu_temp_c: null,
      vram_used_gb: null,
      vram_total_gb: null,
      disk_free_gb: 120 + Math.random() * 10,
      disk_total_gb: 500,
      timestamp: Date.now(),
    };
    return base;
  }
}

const RING_BUFFER_SIZE = 900; // 30 min at 2s intervals

export function useLiveResources(enabled = true, intervalMs = 2000) {
  const [current, setCurrent] = useState<LiveResources | null>(null);
  const [history, setHistory] = useState<LiveResources[]>([]);
  const historyRef = useRef<LiveResources[]>([]);
  const isVisible = useRef(true);

  const poll = useCallback(async () => {
    if (!isVisible.current) return;
    try {
      const data = await fetchLiveResources();
      setCurrent(data);
      const h = historyRef.current;
      if (h.length >= RING_BUFFER_SIZE) h.shift();
      h.push(data);
      historyRef.current = h;
      setHistory([...h]);
    } catch {
      /* ignore poll errors */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      isVisible.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- polling external system data
    poll(); // initial
    const id = setInterval(poll, intervalMs);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, intervalMs, poll]);

  return { current, history };
}
