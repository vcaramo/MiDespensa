import { createRemoteJWKSet, jwtVerify } from "jose";
import { DurableObject } from "cloudflare:workers";
import { initialState, jsonResponse, MAX_STATE_BYTES, nextState } from "./state.js";

const keySets = new Map();

async function authorized(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return false;
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return false;
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}.cloudflareaccess.com`;
  let jwks = keySets.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    keySets.set(issuer, jwks);
  }
  try {
    await jwtVerify(token, jwks, {
      issuer,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
    });
    return true;
  } catch {
    return false;
  }
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
    if (new URL(request.url).pathname.startsWith("/api/") && !(await authorized(request, env))) {
      return jsonResponse({ error: "Acceso no autorizado. Inicia sesión con Cloudflare Access." }, 403);
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
