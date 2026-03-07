/** FR-060: Offline status indicator */
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 shadow-lg text-xs font-medium animate-in slide-in-from-bottom-2">
      <WifiOff className="h-3.5 w-3.5" />
      <span>Offline — local features still work</span>
    </div>
  );
}
