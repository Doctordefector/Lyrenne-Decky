// node cdp.mjs <targetTitleRegex> <js-expression | @file.js> [screenshot.png]
// Talks to Steam's CEF through an ssh tunnel on localhost:8081.
import fs from "node:fs";
const [, , titleRe, exprArg, shot] = process.argv;
const targets = await (await fetch("http://127.0.0.1:8081/json")).json();
const t = targets.find((x) => new RegExp(titleRe).test(x.title) && x.webSocketDebuggerUrl);
if (!t) { console.error("no target; have:", targets.map((x) => x.title).join(" | ")); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/, "ws://127.0.0.1:8081"));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => (ws.onopen = r));
if (exprArg && exprArg !== "-") {
  const expr = exprArg.startsWith("@") ? fs.readFileSync(exprArg.slice(1), "utf8") : exprArg;
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails ?? r, null, 1));
}
if (shot) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(shot, Buffer.from(r.result.data, "base64")); console.log("saved", shot);
}
ws.close();
