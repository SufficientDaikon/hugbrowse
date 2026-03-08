import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useSystemInfo } from "../../hooks/useSystemInfo";
import { Badge } from "../ui/Badge";
import { Cpu, MemoryStick, MonitorSmartphone } from "lucide-react";

export function AppShell() {
  const { data: sysInfo } = useSystemInfo();

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-[var(--background)]">
          <Outlet />
        </main>
      </div>
      {/* Status Bar */}
      {sysInfo && (
        <footer className="flex h-7 items-center gap-4 border-t border-[var(--border)] bg-[var(--surface)] px-4 text-[11px] text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <Cpu className="h-3 w-3 text-accent dark:text-accent-light" />
            {sysInfo.cpu_name}
          </span>
          <span className="w-px h-3 bg-[var(--border)]" />
          <span className="flex items-center gap-1.5">
            <MemoryStick className="h-3 w-3 text-can-run dark:text-can-run-light" />
            {sysInfo.ram_total_gb}GB RAM
          </span>
          {sysInfo.gpu_name && (
            <>
              <span className="w-px h-3 bg-[var(--border)]" />
              <span className="flex items-center gap-1.5">
                <MonitorSmartphone className="h-3 w-3 text-purple-500 dark:text-purple-400" />
                {sysInfo.gpu_name} ({sysInfo.gpu_vram_gb}GB)
              </span>
            </>
          )}
          <div className="ml-auto">
            <Badge variant="outline" className="text-[10px]">
              v0.1.0
            </Badge>
          </div>
        </footer>
      )}
    </div>
  );
}
