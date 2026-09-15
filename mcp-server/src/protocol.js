/**
 * MCP stdio server: newline-delimited JSON-RPC (MCP spec),
 * plus Content-Length framing for older clients.
 */
export class McpServer {
  constructor({ name, version, instructions = "" }) {
    this.info = { name, version };
    this.instructions = instructions;
    this.tools = new Map();
    this.resources = new Map();
  }

  tool(name, description, inputSchema, handler) {
    const properties = {};
    const required = [];
    for (const [key, def] of Object.entries(inputSchema || {})) {
      const { optional, ...rest } = def;
      properties[key] = rest;
      if (!optional) required.push(key);
    }
    this.tools.set(name, {
      name,
      description,
      inputSchema: { type: "object", properties, required },
      handler,
    });
  }

  resource(name, uri, description, reader) {
    this.resources.set(uri, {
      name,
      uri,
      description,
      mimeType: "text/plain",
      reader,
    });
  }

  async handle(message) {
    if (message.method === "initialize") {
      return {
        protocolVersion: message.params?.protocolVersion || "2024-11-05",
        capabilities: { tools: { listChanged: false }, resources: { subscribe: false } },
        serverInfo: this.info,
        instructions: this.instructions,
      };
    }
    if (
      message.method === "notifications/initialized" ||
      message.method?.startsWith("notifications/")
    ) {
      return undefined;
    }
    if (message.method === "ping") return {};
    if (message.method === "tools/list") {
      return {
        tools: [...this.tools.values()].map(({ handler, ...rest }) => rest),
      };
    }
    if (message.method === "tools/call") {
      const tool = this.tools.get(message.params.name);
      if (!tool) throw new Error(`Unknown tool: ${message.params.name}`);
      const text = await tool.handler(message.params.arguments || {});
      return { content: [{ type: "text", text: String(text) }] };
    }
    if (message.method === "resources/list") {
      return {
        resources: [...this.resources.values()].map(({ reader, ...rest }) => rest),
      };
    }
    if (message.method === "resources/read") {
      const resource = this.resources.get(message.params.uri);
      if (!resource) throw new Error(`Unknown resource: ${message.params.uri}`);
      const text = await resource.reader();
      return {
        contents: [{ uri: resource.uri, mimeType: resource.mimeType, text }],
      };
    }
    throw new Error(`Unsupported method: ${message.method}`);
  }

  start() {
    const send = (payload) => {
      process.stdout.write(`${JSON.stringify(payload)}\n`);
    };

    let buffer = Buffer.alloc(0);
    let chain = Promise.resolve();
    process.stdin.on("data", (chunk) => {
      chain = chain.then(async () => {
        buffer = Buffer.concat([buffer, chunk]);
        buffer = await this.drain(buffer, send);
      });
    });
    process.stdin.on("end", () => process.exit(0));
  }

  async drain(buffer, send) {
    let rest = buffer;
    while (rest.length) {
      const parsed = takeMessage(rest);
      if (!parsed) break;
      rest = parsed.rest;
      const message = parsed.message;
      if (!message) continue;
      if (message.method && message.id === undefined) {
        try {
          await this.handle(message);
        } catch (err) {
          process.stderr.write(`${err.message}\n`);
        }
        continue;
      }
      try {
        const result = await this.handle(message);
        if (result !== undefined) send({ jsonrpc: "2.0", id: message.id, result });
      } catch (err) {
        send({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32000, message: err.message },
        });
      }
    }
    return rest;
  }
}

function takeMessage(buffer) {
  const asStringStart = buffer.slice(0, 16).toString("utf8").toLowerCase();
  if (asStringStart.startsWith("content-length")) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return null;
    const header = buffer.slice(0, headerEnd).toString("utf8");
    const length = Number(/content-length:\s*(\d+)/i.exec(header)?.[1]);
    const start = headerEnd + 4;
    if (!Number.isFinite(length) || buffer.length < start + length) return null;
    const json = buffer.slice(start, start + length).toString("utf8");
    return { message: JSON.parse(json), rest: buffer.slice(start + length) };
  }
  const newline = buffer.indexOf("\n");
  if (newline === -1) return null;
  const line = buffer.slice(0, newline).toString("utf8").trim();
  const rest = buffer.slice(newline + 1);
  if (!line) return { message: null, rest };
  return { message: JSON.parse(line), rest };
}
