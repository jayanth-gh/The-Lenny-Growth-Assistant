import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const port = Number(process.env.PI_AGENT_PORT || 8090);
const model = process.env.OLLAMA_MODEL || "llama3.2";
const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434").replace(/\/$/, "");
const piHome = "/tmp/pi-home";
const piAgentDir = path.join(piHome, ".pi", "agent");
const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const piCommand = path.join(packageRoot, "node_modules", ".bin", "pi");

async function configurePi() {
  await mkdir(piAgentDir, { recursive: true });
  await writeFile(
    path.join(piAgentDir, "models.json"),
    JSON.stringify({
      providers: {
        ollama: {
          baseUrl: `${ollamaBaseUrl}/v1`,
          api: "openai-completions",
          apiKey: "ollama",
          compat: {
            supportsDeveloperRole: false,
            supportsReasoningEffort: false
          },
          models: [
            {
              id: model,
              name: "Llama 3.2 (Ollama)",
              input: ["text"],
              contextWindow: 128000,
              maxTokens: 1200,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
            }
          ]
        }
      }
    }, null, 2),
    "utf8"
  );
}

function jsonResponse(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function runPi(prompt, systemPrompt, maxTokens) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      piCommand,
      [
        "--mode", "rpc",
        "--no-session",
        "--provider", "ollama",
        "--model", model,
        "--api-key", "ollama",
        "--no-tools",
        "--system-prompt", systemPrompt || "You are Lenny Growth Assistant."
      ],
      {
        cwd: packageRoot,
        env: {
          ...process.env,
          HOME: piHome,
          PI_CODING_AGENT_DIR: piAgentDir,
          PI_OFFLINE: "1"
        },
        stdio: ["pipe", "pipe", "pipe"]
      }
    );

    let output = "";
    let stderr = "";
    let buffer = "";
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Pi agent timed out after ${maxTokens} output-token limit`));
    }, 180000);

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (child.exitCode === null) child.kill("SIGTERM");
      if (error) reject(error);
      else resolve(value);
    };

    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let event;
        try { event = JSON.parse(line); } catch { continue; }
        if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
          output += event.assistantMessageEvent.delta;
        }
        if (event.type === "message_end" && event.message?.role === "assistant") {
          const blocks = event.message.content || [];
          const messageText = blocks.filter((block) => block.type === "text").map((block) => block.text).join("");
          if (messageText) output = messageText;
        }
        if (event.type === "agent_end" && !output) {
          const messages = event.messages || [];
          const assistant = [...messages].reverse().find((message) => message.role === "assistant");
          const blocks = assistant?.content || [];
          output = blocks.filter((block) => block.type === "text").map((block) => block.text).join("");
        }
        if (event.type === "agent_settled") {
          finish(null, output.trim());
        }
      }
    });
    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (code !== 0 && !output) finish(new Error(stderr.trim() || `Pi exited with code ${code}`));
      else if (!settled) finish(null, output.trim());
    });

    child.stdin.write(JSON.stringify({ type: "prompt", message: prompt }) + "\n");
  });
}

await configurePi();

createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    return jsonResponse(response, 200, {
      status: "healthy",
      agent: "pi-coding-agent",
      provider: "ollama",
      model,
      ollama_base_url: ollamaBaseUrl
    });
  }

  if (request.method === "POST" && request.url === "/generate") {
    try {
      const body = JSON.parse(await readBody(request));
      const content = await runPi(body.prompt || "", body.system_prompt, Number(body.max_tokens || 1200));
      return jsonResponse(response, 200, {
        content,
        model_used: `pi/ollama/${model}`,
        agent: "pi-coding-agent"
      });
    } catch (error) {
      return jsonResponse(response, 502, { error: error.message });
    }
  }

  return jsonResponse(response, 404, { error: "Not found" });
}).listen(port, "0.0.0.0", () => {
  console.log(`Pi coding agent bridge listening on ${port} with Ollama model ${model}`);
});
