import { useEffect, useRef, useState, useCallback } from "react";
import type { LiveResources, ResourceAlert } from "../lib/hf-types";
import { useSettings } from "../stores/settings";

export function useAlerts(current: LiveResources | null) {
  const { alertThresholds } = useSettings();
  const [alerts, setAlerts] = useState<ResourceAlert[]>([]);
  const firedRef = useRef<Set<string>>(new Set());

  const dismiss = useCallback((type: string) => {
    setAlerts((prev) => prev.filter((a) => a.type !== type));
    // Allow re-fire after crossing below then above threshold again
    firedRef.current.delete(type);
  }, []);

  useEffect(() => {
    if (!current) return;

    const newAlerts: ResourceAlert[] = [];

    const ramPct = (current.ram_used_gb / current.ram_total_gb) * 100;
    if (ramPct >= alertThresholds.ram && !firedRef.current.has("ram")) {
      firedRef.current.add("ram");
      newAlerts.push({
        type: "ram",
        threshold: alertThresholds.ram,
        current: Math.round(ramPct),
        message: `High RAM usage (${Math.round(ramPct)}%) — consider closing apps`,
      });
    } else if (ramPct < alertThresholds.ram - 5) {
      firedRef.current.delete("ram");
    }

    if (
      current.vram_used_gb != null &&
      current.vram_total_gb != null &&
      current.vram_total_gb > 0
    ) {
      const vramPct = (current.vram_used_gb / current.vram_total_gb) * 100;
      if (vramPct >= alertThresholds.vram && !firedRef.current.has("vram")) {
        firedRef.current.add("vram");
        newAlerts.push({
          type: "vram",
          threshold: alertThresholds.vram,
          current: Math.round(vramPct),
          message: `GPU memory critical (${Math.round(vramPct)}%) — unload a model or reduce batch size`,
        });
      } else if (vramPct < alertThresholds.vram - 5) {
        firedRef.current.delete("vram");
      }
    }

    if (
      current.cpu_percent >= alertThresholds.cpu &&
      !firedRef.current.has("cpu")
    ) {
      firedRef.current.add("cpu");
      newAlerts.push({
        type: "cpu",
        threshold: alertThresholds.cpu,
        current: Math.round(current.cpu_percent),
        message: `CPU usage very high (${Math.round(current.cpu_percent)}%)`,
      });
    } else if (current.cpu_percent < alertThresholds.cpu - 5) {
      firedRef.current.delete("cpu");
    }

    if (newAlerts.length > 0) {
      setAlerts((prev) => [
        ...prev.filter((a) => !newAlerts.some((n) => n.type === a.type)),
        ...newAlerts,
      ]);
    }
  }, [current, alertThresholds]);

  return { alerts, dismiss };
}
