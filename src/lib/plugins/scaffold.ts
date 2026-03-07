/** FR-085: Plugin scaffolding template generator */
import type { PluginManifest, PluginPermission } from "../marketplace/types";

export interface ScaffoldOptions {
  name: string;
  description: string;
  author: string;
  permissions: PluginPermission[];
}

const MANIFEST_TEMPLATE = (opts: ScaffoldOptions): PluginManifest => ({
  name: opts.name,
  version: "1.0.0",
  description: opts.description,
  author: opts.author,
  entryPoint: "index.js",
  apiVersion: 1,
  permissions: opts.permissions,
  ui: [
    {
      type: "sidebar-panel",
      label: opts.name,
      entryPoint: "panel.html",
    },
  ],
});

const INDEX_JS_TEMPLATE = (name: string) => `// ${name} — HugBrowse Plugin
// See https://hugbrowse.dev/docs/plugins for API reference

const hugbrowse = window.hugbrowse;

// Called when the plugin is loaded
async function onActivate() {
  console.log("${name} activated!");
  
  // Example: Get current model info
  const model = await hugbrowse.getModelStatus();
  console.log("Current model:", model);
}

// Called when the plugin is unloaded
async function onDeactivate() {
  console.log("${name} deactivated");
}

onActivate();
`;

const PANEL_HTML_TEMPLATE = (name: string) => `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui; padding: 16px; color: #e6edf3; background: transparent; }
    h2 { font-size: 14px; margin-bottom: 8px; }
    p { font-size: 12px; color: #8b949e; }
  </style>
</head>
<body>
  <h2>${name}</h2>
  <p>Your plugin panel content goes here.</p>
  <script src="index.js"></script>
</body>
</html>
`;

const README_TEMPLATE = (opts: ScaffoldOptions) => `# ${opts.name}

${opts.description}

## Installation

1. Open HugBrowse → Marketplace → Installed
2. Click "Load Local Plugin"
3. Select this folder

## Development

Edit \`index.js\` to add your plugin logic. The HugBrowse Plugin API is available via \`window.hugbrowse\`.

### Available API Methods

- \`hugbrowse.getModelStatus()\` — Get loaded model info
- \`hugbrowse.sendChatMessage(text)\` — Send a chat message
- \`hugbrowse.readSetting(key)\` — Read a plugin setting
- \`hugbrowse.writeSetting(key, value)\` — Write a plugin setting

### Permissions

This plugin requires: ${opts.permissions.join(", ") || "none"}

## Publishing

1. Zip this entire folder
2. Go to Marketplace → Publish
3. Upload the zip and fill in details
`;

export function generatePluginScaffold(opts: ScaffoldOptions): Map<string, string> {
  const files = new Map<string, string>();
  files.set("manifest.json", JSON.stringify(MANIFEST_TEMPLATE(opts), null, 2));
  files.set("index.js", INDEX_JS_TEMPLATE(opts.name));
  files.set("panel.html", PANEL_HTML_TEMPLATE(opts.name));
  files.set("README.md", README_TEMPLATE(opts));
  return files;
}
