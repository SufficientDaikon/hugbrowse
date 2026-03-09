import { useEffect } from 'react';
import { usePluginStore } from '../../stores/pluginStore';

/** Plugin manager — install, enable, disable, and configure plugins. */
export default function PluginManager() {
  const { plugins, loading, error, fetchPlugins, enablePlugin, disablePlugin, uninstallPlugin, rescanPlugins } = usePluginStore();

  useEffect(() => {
    fetchPlugins();
  }, []);

  const typeColors: Record<string, string> = {
    tool: 'bg-blue-600',
    preprocessor: 'bg-purple-600',
    generator: 'bg-green-600',
    ui: 'bg-orange-600',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Plugins</h3>
          <p className="text-sm text-zinc-400">Manage TypeScript/JavaScript plugins</p>
        </div>
        <button
          onClick={rescanPlugins}
          disabled={loading}
          className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Scanning...' : 'Rescan'}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {(plugins ?? []).length === 0 && !loading && (
        <div className="text-center py-8 text-zinc-500">
          <p className="text-sm">No plugins installed.</p>
          <p className="text-xs mt-1">Place plugin folders in the plugins directory and click Rescan.</p>
        </div>
      )}

      {(plugins ?? []).map((plugin) => (
        <div key={plugin.id} className="bg-zinc-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{plugin.manifest.name}</span>
              <span className="text-xs text-zinc-400">v{plugin.manifest.version}</span>
              <span className={`text-xs text-white px-2 py-0.5 rounded ${typeColors[plugin.manifest.type] || 'bg-zinc-600'}`}>
                {plugin.manifest.type}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {plugin.status === 'enabled' ? (
                <button
                  onClick={() => disablePlugin(plugin.id)}
                  className="text-xs text-yellow-400 hover:text-yellow-300"
                >
                  Disable
                </button>
              ) : (
                <button
                  onClick={() => enablePlugin(plugin.id)}
                  className="text-xs text-green-400 hover:text-green-300"
                >
                  Enable
                </button>
              )}
              <button
                onClick={() => uninstallPlugin(plugin.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Uninstall
              </button>
            </div>
          </div>
          <p className="text-sm text-zinc-400">{plugin.manifest.description}</p>
          <div className="text-xs text-zinc-500 flex gap-3">
            <span>Author: {plugin.manifest.author}</span>
            <span>Status: {plugin.status}</span>
            {plugin.manifest.permissions.length > 0 && (
              <span>Permissions: {plugin.manifest.permissions.join(', ')}</span>
            )}
          </div>
          {plugin.error && <p className="text-xs text-red-400">{plugin.error}</p>}
        </div>
      ))}
    </div>
  );
}
