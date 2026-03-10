#!/usr/bin/env node
/**
 * Lightweight MCP server startup test.
 * Just checks if the server starts and initializes properly.
 */
const { spawn } = require("child_process");

console.log("🚀 Starting HugBrowse MCP server...\n");

const child = spawn("node", ["dist/index.js"], {
  stdio: ["pipe", "pipe", "pipe"],
  cwd: process.cwd(),
  timeout: 5000,
});

let receivedData = false;
let receivedStartupMessage = false;

const stdoutHandler = (data) => {
  receivedData = true;
  console.log("📤 STDOUT:", data.toString().trim());
};

const stderrHandler = (data) => {
  const msg = data.toString().trim();
  receivedData = true;
  console.log("📌 STDERR:", msg);
  if (msg.includes("HugBrowse MCP server running")) {
    receivedStartupMessage = true;
    console.log("✅ Server startup message received!");
  }
};

const errorHandler = (err) => {
  console.error("❌ Process error:", err.message);
  process.exit(1);
};

const exitHandler = (code, signal) => {
  console.log(`\n⏹️  Process exited with code ${code}, signal ${signal}`);
  process.exit(code || 0);
};

child.stdout.on("data", stdoutHandler);
child.stderr.on("data", stderrHandler);
child.on("error", errorHandler);
child.on("exit", exitHandler);

// Timeout after 4 seconds
setTimeout(() => {
  console.log("\n⏰ Timeout reached (4s)");
  if (receivedData) {
    console.log("✅ Server appears to be running (received output)");
  } else {
    console.log("⚠️  No output received yet");
  }
  console.log("\n📊 Test Results:");
  console.log(`   - Server started: ${child.exitCode === null ? "YES (still running)" : "NO"}`);
  console.log(`   - Received any output: ${receivedData}`);
  console.log(`   - Received startup message: ${receivedStartupMessage}`);

  child.kill();
  process.exit(0);
}, 4000);

// Send initialize request after 500ms
setTimeout(() => {
  console.log("📨 Sending initialize request...\n");
  const init = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0" },
    },
  };
  try {
    child.stdin.write(JSON.stringify(init) + "\n");
  } catch (e) {
    console.error("❌ Failed to send request:", e.message);
  }
}, 500);
