import { DurableObject } from "cloudflare:workers";
import { initialState, jsonResponse, MAX_STATE_BYTES, nextState } from "./state.js";

async function authorized(request, env) {
  const supplied = request.headers.get("X-Despensa-Password");
  if (!supplied || supplied.length > 1024) return false;
  let decoded;
  try { decoded = decodeURIComponent(supplied); } catch { return false; }
  const encoder = new TextEncoder();
  const [actual, expected] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(decoded)),
    crypto.subtle.digest("SHA-256", encoder.encode(env.APP_PASSWORD)),
  ]);
  const a = new Uint8Array(actual);
  const b = new Uint8Array(expected);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export async function handleApi(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (url.pathname === "/api/health" && request.method === "GET") {
    return new Response("despensa-ok", { headers: { "Cache-Control": "no-store, private" } });
  }
  if (url.pathname !== "/api/state" || !["GET", "PUT"].includes(request.method)) {
    return jsonResponse({ error: "Ruta no encontrada." }, 404);
  }
  const id = env.DESPENSA_STATE.idFromName("hogar-principal");
  return env.DESPENSA_STATE.get(id).fetch(request);
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith("/api/")) {
      if (!env.APP_PASSWORD || env.APP_PASSWORD.length < 16) {
        return jsonResponse({ error: "El acceso todavía no está configurado en Cloudflare." }, 503);
      }
      if (!(await authorized(request, env))) {
        return jsonResponse({ error: "Contraseña incorrecta." }, 401);
      }
    }
    return handleApi(request, env);
  },
};

export class DespensaState extends DurableObject {
  async starter(request) {
    const url = new URL("/catalogo-inicial.json", request.url);
    const response = await this.env.ASSETS.fetch(new Request(url));
    if (!response.ok) throw new Error("No se pudo cargar el catálogo inicial.");
    return initialState(await response.json());
  }

  async fetch(request) {
    try {
      const stored = await this.ctx.storage.get("json");
      const seed = stored === undefined ? await this.starter(request) : null;
      if (request.method === "GET") {
        if (stored !== undefined) return jsonResponse(JSON.parse(stored));
        const initialized = await this.ctx.storage.transaction(async (transaction) => {
          const current = await transaction.get("json");
          if (current !== undefined) return JSON.parse(current);
          await transaction.put("json", JSON.stringify(seed));
          return seed;
        });
        return jsonResponse(initialized);
      }
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_STATE_BYTES) {
        return jsonResponse({ error: "El JSON supera el límite de 2 MB." }, 413);
      }
      let input;
      try { input = JSON.parse(raw); } catch { return jsonResponse({ error: "JSON no válido." }, 400); }
      const result = await this.ctx.storage.transaction(async (transaction) => {
        const snapshot = await transaction.get("json");
        const current = snapshot === undefined ? seed : JSON.parse(snapshot);
        const changed = nextState(current, input.expectedRevision, input.state);
        if (changed === null) return null;
        await transaction.put("json", JSON.stringify(changed));
        return changed;
      });
      if (result === null) return jsonResponse({ error: "El inventario cambió. Actualiza y vuelve a intentarlo." }, 409);
      return jsonResponse(result);
    } catch (error) {
      if (error instanceof TypeError || error?.name === "DomainError") {
        return jsonResponse({ error: error.message }, 400);
      }
      return jsonResponse({ error: "Error al acceder al JSON compartido." }, 500);
    }
  }
}
