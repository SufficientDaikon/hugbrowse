import type { LiveResources } from "../../lib/hf-types";
import { useRef, useEffect } from "react";

interface ResourceHistoryProps {
  history: LiveResources[];
  height?: number;
}

const COLORS = {
  cpu: "#6366f1",
  ram: "#22c55e",
  gpu: "#a855f7",
  vram: "#f97316",
};

export function ResourceHistory({
  history,
  height = 200,
}: ResourceHistoryProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--border")
        .trim() || "#334155";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Draw labels
    ctx.fillStyle =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--muted")
        .trim() || "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.fillText("100%", 2, 12);
    ctx.fillText("50%", 2, h / 2 + 4);
    ctx.fillText("0%", 2, h - 2);

    const padL = 32;
    const drawW = w - padL;

    function drawLine(data: number[], color: string) {
      if (!ctx || data.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";

      data.forEach((val, i) => {
        const x = padL + (i / (data.length - 1)) * drawW;
        const y = h - (val / 100) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // CPU
    drawLine(
      history.map((h) => h.cpu_percent),
      COLORS.cpu,
    );
    // RAM
    drawLine(
      history.map((h) => (h.ram_used_gb / h.ram_total_gb) * 100),
      COLORS.ram,
    );
    // GPU (if available)
    const gpuData = history.map((h) => h.gpu_percent);
    if (gpuData.some((v) => v != null)) {
      drawLine(
        gpuData.map((v) => v ?? 0),
        COLORS.gpu,
      );
    }
    // VRAM (if available)
    const vramData = history.map((h) =>
      h.vram_used_gb != null && h.vram_total_gb
        ? (h.vram_used_gb / h.vram_total_gb) * 100
        : null,
    );
    if (vramData.some((v) => v != null)) {
      drawLine(
        vramData.map((v) => v ?? 0),
        COLORS.vram,
      );
    }
  }, [history, height]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">📈 Usage History</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-0.5 rounded"
              style={{ background: COLORS.cpu }}
            />{" "}
            CPU
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-0.5 rounded"
              style={{ background: COLORS.ram }}
            />{" "}
            RAM
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-0.5 rounded"
              style={{ background: COLORS.gpu }}
            />{" "}
            GPU
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-0.5 rounded"
              style={{ background: COLORS.vram }}
            />{" "}
            VRAM
          </span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height }}
        className="rounded-lg"
      />
      <p className="text-xs text-[var(--muted)] mt-2">
        {history.length} samples • Updates every 2 seconds • Max 30 minutes
      </p>
    </div>
  );
}
