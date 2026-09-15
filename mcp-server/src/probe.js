import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "index.js");

export function callTool(name, args = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    let settled = false;
    const done = (fn, value) => {
      if (settled) return;
      settled = true;
      child.kill();
      fn(value);
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      out += chunk;
      for (const line of out.split("\n").filter(Boolean)) {
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.id === 2 && msg.result) {
          done(resolve, msg.result.content?.[0]?.text ?? JSON.stringify(msg.result));
          return;
        }
        if (msg.id === 2 && msg.error) {
          done(reject, new Error(msg.error.message));
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("exit", (code) => {
      if (!settled && code && code !== 0) {
        done(reject, new Error(err || `MCP server exited ${code}`));
      }
    });

    setTimeout(() => {
      done(reject, new Error(`MCP probe timed out. stderr=${err} stdout=${out}`));
    }, 8000);

    const send = (obj) => child.stdin.write(`${JSON.stringify(obj)}\n`);
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "probe", version: "1.0.0" },
      },
    });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name, arguments: args },
    });
  });
}

if (process.argv[1] && process.argv[1].endsWith("probe.js")) {
  const tool = process.argv[2] || "explain_win_check";
  const text = await callTool(tool);
  console.log(text);
}
