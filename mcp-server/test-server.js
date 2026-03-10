#!/usr/bin/env node
/**
 * Simple test script for the MCP server.
 * Spawns the server and sends test RPC calls.
 */
const { spawn } = require("child_process");

const child = spawn("node", ["dist/index.js"], {
  stdio: ["pipe", "pipe", "pipe"],
  cwd: process.cwd(),
});

let stdout = "";
let stderr = "";
let responseCount = 0;

child.stdout.on("data", (data) => {
  const str = data.toString();
  stdout += str;
  console.log("📤 STDOUT:", str.trim());
  responseCount++;
});

child.stderr.on("data", (data) => {
  const str = data.toString();
  stderr += str;
  console.log("⚠️  STDERR:", str.trim());
});

child.on("error", (err) => {
  console.error("❌ Process error:", err);
});

process.on("SIGINT", () => {
  child.kill();
  process.exit(0);
});

// Step 1: Send initialize request
console.log("\n🔄 Step 1: Sending initialize request...");
const init = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0" },
  },
};
child.stdin.write(JSON.stringify(init) + "\n");

// Step 2: After 1.5s, send tools/list request
setTimeout(() => {
  console.log("\n🔄 Step 2: Sending tools/list request...");
  const listTools = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  };
  child.stdin.write(JSON.stringify(listTools) + "\n");
}, 1500);

// Step 3: After 3s, send another tool request
setTimeout(() => {
  console.log("\n🔄 Step 3: Sending callTool request for hugbrowse_server_status...");
  const callTool = {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "hugbrowse_server_status",
      arguments: {},
    },
  };
  child.stdin.write(JSON.stringify(callTool) + "\n");
}, 3000);

// Step 4: Final summary after 6s
setTimeout(() => {
  console.log("\n\n📊 SUMMARY:");
  console.log(`   Total responses received: ${responseCount}`);
  console.log(`   Stdout length: ${stdout.length} chars`);
  console.log(`   Stderr length: ${stderr.length} chars`);
  console.log("\n✅ Test complete. Killing server...\n");
  child.kill();
  process.exit(0);
}, 6000);

// Safety timeout to force exit
setTimeout(() => {
  console.error("\n❌ Timeout! Force killing server...");
  child.kill("SIGKILL");
  process.exit(1);
}, 8000);
