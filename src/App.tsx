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
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { useSettings } from "./stores/settings";
import { useInference } from "./stores/inference";
import { hfApi } from "./lib/hf-api";
import { useEffect } from "react";

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

export default function App() {
  const { onboardingComplete } = useSettings();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TokenSync />
        <AutoModelLoader />
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
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
