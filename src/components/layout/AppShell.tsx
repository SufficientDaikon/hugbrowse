import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useSystemInfo } from "../../hooks/useSystemInfo";
import { Badge } from "../ui/Badge";
import { Cpu, MemoryStick, MonitorSmartphone, Server, Layers } from "lucide-react";
import { useApiServer } from "../../stores/apiServer";
import { useModelManager } from "../../stores/modelManager";

export function AppShell() {
  const { data: sysInfo } = useSystemInfo();
  const location = useLocation();
  const showSidebar = location.pathname === "/";
  const { running: serverRunning, port: serverPort } = useApiServer();
  const { loadedModels } = useModelManager();
  const modelCount = (loadedModels ?? []).length;

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && <Sidebar />}
        <main className="flex-1 overflow-y-auto bg-[var(--background)] surface-mesh">
          <Outlet />
        </main>
      </div>
      {/* Status Bar */}
      {sysInfo && (
        <footer className="flex h-7 items-center gap-4 border-t border-[var(--border-subtle)] bg-[var(--surface)] px-5 text-[11px] text-[var(--muted)]">
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
          <span className="w-px h-3 bg-[var(--border)]" />
          <span className="flex items-center gap-1.5">
            <Layers className="h-3 w-3 text-blue-500" />
            {modelCount} model{modelCount !== 1 ? 's' : ''} loaded
          </span>
          <span className="w-px h-3 bg-[var(--border)]" />
          <span className="flex items-center gap-1.5">
            <Server className="h-3 w-3" style={{ color: serverRunning ? '#22c55e' : '#71717a' }} />
            API {serverRunning ? `●:${serverPort}` : 'off'}
          </span>
          <div className="ml-auto">
            <Badge variant="outline" className="text-[10px]">
              v1.0.0
            </Badge>
          </div>
        </footer>
      )}
    </div>
  );
}
