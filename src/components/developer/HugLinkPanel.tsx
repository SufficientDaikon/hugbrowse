import { useEffect } from 'react';
import { useHugLinkStore } from '../../stores/huglink';

/** HugLink panel — cross-device model sharing management. */
export default function HugLinkPanel() {
  const { enabled, devices, status, loading, error, fetchStatus, fetchDevices, setEnabled, setPreferred } = useHugLinkStore();

  useEffect(() => {
    fetchStatus();
    fetchDevices();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">HugLink</h3>
          <p className="text-sm text-zinc-400">Share models across devices via encrypted P2P</p>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            enabled
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {enabled ? 'Disable' : 'Enable'}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {status && (
        <div className="bg-zinc-800 rounded-lg p-3 text-sm text-zinc-300 space-y-1">
          <p>Device Name: <span className="text-white">{status.deviceName}</span></p>
          <p>Connected Devices: <span className="text-white">{status.connectedDevices}</span></p>
          {status.preferredDevice && (
            <p>Preferred: <span className="text-white">{status.preferredDevice}</span></p>
          )}
        </div>
      )}

      {loading && <p className="text-zinc-400 text-sm">Loading devices...</p>}

      {(devices ?? []).length === 0 && !loading && enabled && (
        <p className="text-zinc-500 text-sm">No remote devices discovered yet. Enable HugLink on another device on the same network.</p>
      )}

      {(devices ?? []).map((device) => (
        <div key={device.id} className="bg-zinc-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${device.isOnline ? 'bg-green-500' : 'bg-zinc-500'}`} />
              <span className="text-white font-medium">{device.name}</span>
              {device.isPreferred && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Preferred</span>}
            </div>
            {!device.isPreferred && (
              <button
                onClick={() => setPreferred(device.id)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Set Preferred
              </button>
            )}
          </div>
          <div className="text-sm text-zinc-400 grid grid-cols-3 gap-2">
            <span>GPU: {device.hardware.gpu}</span>
            <span>VRAM: {device.hardware.vramMb}MB</span>
            <span>Latency: {device.latencyMs}ms</span>
          </div>
          {device.loadedModels.length > 0 && (
            <div className="text-xs text-zinc-500">
              Models: {device.loadedModels.join(', ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
