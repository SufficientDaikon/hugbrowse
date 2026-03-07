import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "./components/layout/AppShell";
import { SearchPage } from "./pages/SearchPage";
import { ModelDetailPage } from "./pages/ModelDetailPage";
import { SettingsPage } from "./pages/SettingsPage";
import { RecommendedPage } from "./pages/RecommendedPage";
import { ResourceMonitorPage } from "./pages/ResourceMonitorPage";
import { ChatPage } from "./pages/ChatPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { MarketplacePage } from "./pages/marketplace/MarketplacePage";
import { CommunityPage } from "./pages/marketplace/CommunityPage";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { UpdateNotification } from "./components/ui/UpdateNotification";
import { OfflineIndicator } from "./components/ui/OfflineIndicator";
import { KeyboardShortcuts } from "./components/ui/KeyboardShortcuts";
import { PrivacyConsent } from "./components/ui/PrivacyConsent";
import { useSettings } from "./stores/settings";
import { useInference } from "./stores/inference";
import { hfApi } from "./lib/hf-api";
import { useEffect, useState } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

function TokenSync() {
  const { hfToken, loadTokenFromStore } = useSettings();
  useEffect(() => {
    loadTokenFromStore();
  }, [loadTokenFromStore]);
  useEffect(() => {
    hfApi.setToken(hfToken);
  }, [hfToken]);
  return null;
}

/** FR-032: Auto-load last model on app launch if enabled */
function AutoModelLoader() {
  const { autoLoadLastModel, lastModelPath } = useSettings();
  const load = useInference((s) => s.load);
  const status = useInference((s) => s.info.status);

  useEffect(() => {
    if (autoLoadLastModel && lastModelPath && status === "unloaded") {
      const name = lastModelPath.split(/[\\/]/).pop() ?? "model";
      load({ modelPath: lastModelPath, modelName: name });
    }
  }, [autoLoadLastModel, lastModelPath, status, load]);

  return null;
}

/** EC-017: Save/restore window position for multi-monitor support */
function WindowPositionTracker() {
  const { windowPosition, setWindowPosition } = useSettings();

  useEffect(() => {
    // Restore window position on mount
    async function restorePosition() {
      if (!windowPosition) return;
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        await win.setPosition(
          new (await import("@tauri-apps/api/dpi")).LogicalPosition(
            windowPosition.x,
            windowPosition.y,
          ),
        );
        await win.setSize(
          new (await import("@tauri-apps/api/dpi")).LogicalSize(
            windowPosition.w,
            windowPosition.h,
          ),
        );
      } catch {
        /* Tauri API not available (browser dev) */
      }
    }
    restorePosition();
  }, []); // Run once on mount

  useEffect(() => {
    // Save position periodically
    let interval: ReturnType<typeof setInterval>;
    async function startTracking() {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        interval = setInterval(async () => {
          try {
            const pos = await win.outerPosition();
            const size = await win.outerSize();
            setWindowPosition({
              x: pos.x,
              y: pos.y,
              w: size.width,
              h: size.height,
            });
          } catch {
            /* ignore */
          }
        }, 5000); // Save every 5s
      } catch {
        /* Tauri API not available */
      }
    }
    startTracking();
    return () => clearInterval(interval);
  }, [setWindowPosition]);

  return null;
}

export default function App() {
  const { onboardingComplete } = useSettings();
  const [privacyAccepted, setPrivacyAccepted] = useState(
    () => localStorage.getItem("hugbrowse-privacy-accepted") === "true",
  );

  // FR-057: Show privacy consent before main app if not yet accepted
  if (onboardingComplete && !privacyAccepted) {
    return (
      <PrivacyConsent onComplete={() => setPrivacyAccepted(true)} />
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TokenSync />
        <AutoModelLoader />
        <WindowPositionTracker />
        <UpdateNotification />
        <OfflineIndicator />
        <KeyboardShortcuts />
        <BrowserRouter>
          <Routes>
            {!onboardingComplete && (
              <Route path="*" element={<OnboardingPage />} />
            )}
            <Route element={<AppShell />}>
              <Route path="/" element={<SearchPage />} />
              <Route
                path="/model/:id"
                element={
                  <ErrorBoundary>
                    <ModelDetailPage />
                  </ErrorBoundary>
                }
              />
              <Route path="/recommended" element={<RecommendedPage />} />
              <Route path="/monitor" element={<ResourceMonitorPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route
                path="/chat"
                element={
                  <ErrorBoundary>
                    <ChatPage />
                  </ErrorBoundary>
                }
              />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/community" element={<CommunityPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
