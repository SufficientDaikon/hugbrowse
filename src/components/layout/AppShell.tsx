import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useSystemInfo } from "../../hooks/useSystemInfo";
import { Badge } from "../ui/Badge";

export function AppShell() {
  const { data: sysInfo } = useSystemInfo();

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      {/* Status Bar */}
      {sysInfo && (
        <footer className="flex h-7 items-center gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-4 text-xs text-[var(--muted)]">
          <span>💻 {sysInfo.cpu_name}</span>
          <span>•</span>
          <span>🧠 {sysInfo.ram_total_gb}GB RAM</span>
          {sysInfo.gpu_name && (
            <>
              <span>•</span>
              <span>
                🎮 {sysInfo.gpu_name} ({sysInfo.gpu_vram_gb}GB)
              </span>
            </>
          )}
          <div className="ml-auto">
            <Badge variant="outline">v0.1.0</Badge>
          </div>
        </footer>
      )}
    </div>
  );
}
