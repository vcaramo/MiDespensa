import { DurableObject } from "cloudflare:workers";
import { initialState, jsonResponse, MAX_STATE_BYTES, nextState } from "./state.js";
import { createSession, hashPassword, sessionCookie, sessionToken, verifyPassword } from "./auth.js";

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
  if (url.pathname.startsWith("/api/product/") && request.method === "GET") {
    const code = decodeURIComponent(url.pathname.slice("/api/product/".length));
    if (!/^\d{8,14}$/.test(code)) return jsonResponse({ error: "Código de barras no válido." }, 400);
    const fields = "code,product_name,product_name_es,brands,categories,categories_tags,quantity,image_url,product_type";
    const userAgent = { "User-Agent": "MiDespensa/1.0 (personal pantry app)" };
    const sources = [
      { name: "Open Food Facts", url: `https://world.openfoodfacts.org/api/v2/product/${code}?product_type=all&fields=${fields}`, kind: "openfacts" },
      { name: "Open Beauty Facts", url: `https://world.openbeautyfacts.org/api/v2/product/${code}?fields=${fields}`, kind: "openfacts" },
      { name: "Open Products Facts", url: `https://world.openproductsfacts.org/api/v2/product/${code}?fields=${fields}`, kind: "openfacts" },
      { name: "UPCitemdb", url: `https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, kind: "upc" },
    ];
    for (const source of sources) {
      try {
        const response = await fetch(source.url, { headers: userAgent });
        if (!response.ok) continue;
        const data = await response.json();
        if (source.kind === "openfacts" && (data.status !== 1 || !data.product)) continue;
        if (source.kind === "upc" && (data.code !== "OK" || !data.items?.[0])) continue;
        const product = source.kind === "openfacts" ? data.product : data.items[0];
        return jsonResponse({
          found: true,
          source: source.name,
          code,
          name: product.product_name_es || product.product_name || product.title || "",
          brand: product.brands || product.brand || "",
          categories: product.categories || product.category || "",
          categoryTags: Array.isArray(product.categories_tags) ? product.categories_tags : [],
          quantity: product.quantity || product.size || "",
          imageUrl: product.image_url || product.images?.[0] || "",
          productType: product.product_type || "product",
        });
      } catch { /* probar la siguiente fuente */ }
    }
    return jsonResponse({ found: false }, 200);
  }
  const usersRoute = url.pathname === "/api/users" || /^\/api\/users\/[^/]+$/.test(url.pathname);
  const productRoute = url.pathname.startsWith("/api/product/");
  if ((!usersRoute && !productRoute && url.pathname !== "/api/state" && url.pathname !== "/api/backups" && !url.pathname.startsWith("/api/backups/") && url.pathname !== "/api/history") || !["GET", "PUT", "POST"].includes(request.method)) {
    return jsonResponse({ error: "Ruta no encontrada." }, 404);
  }
  const id = env.DESPENSA_STATE.idFromName("hogar-principal");
  return env.DESPENSA_STATE.get(id).fetch(request);
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith("/api/auth/")) {
      const id = env.DESPENSA_STATE.idFromName("hogar-principal");
      const forwarded = new Request(request);
      if (env.APP_PASSWORD) forwarded.headers.set("X-Despensa-Bootstrap", env.APP_PASSWORD);
      return env.DESPENSA_STATE.get(id).fetch(forwarded);
    }
    if (pathname.startsWith("/api/")) {
      if (!env.APP_PASSWORD || env.APP_PASSWORD.length < 16) {
        return jsonResponse({ error: "El acceso todavía no está configurado en Cloudflare." }, 503);
      }
      const hasCookie = Boolean(request.headers.get("Cookie")?.includes("despensa_session="));
      if (!hasCookie && !(await authorized(request, env))) {
        return jsonResponse({ error: "Contraseña incorrecta." }, 401);
      }
    }
    return handleApi(request, env);
  },
};

export class DespensaState extends DurableObject {
  async auth(request) {
    const url = new URL(request.url);
    let users = (await this.ctx.storage.get("users")) ?? [];
    const bootstrapPassword = request.headers.get("X-Despensa-Bootstrap");
    if (!users.length && bootstrapPassword) {
      const password = await hashPassword(bootstrapPassword);
      users = [{ id: "admin", identificador: "admin", nombre: "Administrador", perfil: "administrador", activo: true, password }];
      await this.ctx.storage.put("users", users);
    }
    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      const body = await request.json();
      let user = users.find((entry) => entry.identificador === body.identificador && entry.activo !== false);
      if (body.identificador === "admin" && bootstrapPassword && body.password === bootstrapPassword) {
        user = { id: "admin", identificador: "admin", nombre: "Administrador", perfil: "administrador", activo: true, password: await hashPassword(bootstrapPassword) };
        users = [user, ...users.filter((entry) => entry.id !== "admin")];
        await this.ctx.storage.put("users", users);
      }
      if (!user || !(await verifyPassword(body.password ?? "", user.password))) return jsonResponse({ error: "Credenciales incorrectas." }, 401);
      const session = createSession(user.id);
      await this.ctx.storage.put(`session:${session.token}`, session);
      return new Response(JSON.stringify({ id: user.id, nombre: user.nombre, perfil: user.perfil }), { headers: { "Content-Type": "application/json", "Set-Cookie": sessionCookie(session.token) } });
    }
    const token = sessionToken(request);
    const storedSession = token ? await this.ctx.storage.get(`session:${token}`) : null;
    const session = typeof storedSession === "string" ? JSON.parse(storedSession) : storedSession;
    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      if (token) await this.ctx.storage.delete(`session:${token}`);
      return new Response(null, { status: 204, headers: { "Set-Cookie": "despensa_session=; Path=/; Max-Age=0" } });
    }
    if (url.pathname === "/api/auth/me" && request.method === "GET" && session?.expiresAt > Date.now()) {
      const user = users.find((entry) => entry.id === session.userId && entry.activo !== false);
      if (user) return jsonResponse({ id: user.id, identificador: user.identificador, nombre: user.nombre, perfil: user.perfil });
    }
    return jsonResponse({ error: "Sesión no válida." }, 401);
  }

  async recordHistory(before, after) {
    const changed = ["estancias", "contenedores", "tipos", "productos", "existencias", "compras"]
      .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    if (!changed.length) return;
    const productName = (id, source) => source.productos.find((entry) => entry.id === id)?.nombre ?? "producto desconocido";
    const details = [];
    const stock = new Map([...before.existencias, ...after.existencias].map((entry) => [`${entry.productoId}|${entry.contenedorId}`, entry]));
    for (const key of stock.keys()) {
      const [productoId, contenedorId] = key.split("|");
      const previous = before.existencias.find((entry) => `${entry.productoId}|${entry.contenedorId}` === key)?.cantidad ?? 0;
      const current = after.existencias.find((entry) => `${entry.productoId}|${entry.contenedorId}` === key)?.cantidad ?? 0;
      if (current !== previous) details.push(`${current > previous ? "Añadidas" : "Retiradas"} ${Math.abs(current - previous)} ${Math.abs(current - previous) === 1 ? "unidad" : "unidades"} de ${productName(productoId, after)}${contenedorId === "null" ? " (sin contenedor)" : ""}`);
    }
    for (const product of after.productos.filter((entry) => !before.productos.some((old) => old.id === entry.id))) details.push(`Creado producto: ${product.nombre}`);
    for (const item of after.compras) {
      const previous = before.compras.find((entry) => entry.productoId === item.productoId)?.cantidad ?? 0;
      if (item.cantidad !== previous) details.push(`${previous ? "Actualizada" : "Añadida"} compra de ${productName(item.productoId, after)}: ${item.cantidad} unidades`);
    }
    if (!details.length) details.push(...changed.map((key) => `Actualizado: ${key}`));
    const key = `history:${Date.now()}:${after.revision}`;
    await this.ctx.storage.put(key, JSON.stringify({ at: after.updatedAt, revision: after.revision, changed, details }));
    const entries = [...(await this.ctx.storage.list({ prefix: "history:" })).keys()].sort().reverse();
    if (entries.length > 100) await this.ctx.storage.delete(entries.slice(100));
  }

  async ensureDailyBackup(state) {
    const day = new Date().toISOString().slice(0, 10);
    const key = `backup:${day}`;
    if (await this.ctx.storage.get(key) !== undefined) return;
    await this.ctx.storage.put(key, JSON.stringify(state));
    const entries = [...(await this.ctx.storage.list({ prefix: "backup:" })).keys()]
      .sort()
      .slice(0, -30);
    if (entries.length) await this.ctx.storage.delete(entries);
  }

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
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/auth/")) return this.auth(request);
      let sessionUser = { perfil: "administrador" };
      if (!request.headers.get("X-Despensa-Password")) {
        const token = sessionToken(request);
        const storedSession = token ? await this.ctx.storage.get(`session:${token}`) : null;
        const session = typeof storedSession === "string" ? JSON.parse(storedSession) : storedSession;
        if (!session || session.expiresAt <= Date.now()) return jsonResponse({ error: "Sesión no válida." }, 401);
        const users = (await this.ctx.storage.get("users")) ?? [];
        sessionUser = users.find((user) => user.id === session.userId && user.activo !== false);
        if (!sessionUser) return jsonResponse({ error: "Sesión no válida." }, 401);
      }
      if (url.pathname === "/api/backups") {
        if (request.method !== "GET") return jsonResponse({ error: "Método no permitido." }, 405);
        const backups = [...(await this.ctx.storage.list({ prefix: "backup:" })).entries()]
          .map(([key, value]) => ({ date: key.slice("backup:".length), bytes: new TextEncoder().encode(value).byteLength }))
          .sort((a, b) => b.date.localeCompare(a.date));
        return jsonResponse({ backups });
      }
      if (url.pathname.startsWith("/api/backups/")) {
        if (request.method !== "GET") return jsonResponse({ error: "Método no permitido." }, 405);
        const date = decodeURIComponent(url.pathname.slice("/api/backups/".length));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonResponse({ error: "Fecha de copia no válida." }, 400);
        const backup = await this.ctx.storage.get(`backup:${date}`);
        if (backup === undefined) return jsonResponse({ error: "Copia no encontrada." }, 404);
        return jsonResponse(JSON.parse(backup));
      }
      if (url.pathname === "/api/history") {
        if (request.method !== "GET") return jsonResponse({ error: "MÃ©todo no permitido." }, 405);
        const history = [...(await this.ctx.storage.list({ prefix: "history:" })).values()]
          .map((value) => JSON.parse(value))
          .sort((a, b) => b.revision - a.revision)
          .slice(0, 50);
        return jsonResponse({ history });
      }
      if (url.pathname === "/api/users" || url.pathname.startsWith("/api/users/")) {
        if (sessionUser.perfil !== "administrador") return jsonResponse({ error: "Solo un administrador puede gestionar usuarios." }, 403);
        const sanitize = (user) => ({ id: user.id, identificador: user.identificador, nombre: user.nombre, perfil: user.perfil, activo: user.activo !== false });
        const users = (await this.ctx.storage.get("users")) ?? [];
        if (url.pathname === "/api/users" && request.method === "GET") return jsonResponse({ users: users.map(sanitize) });
        if (url.pathname === "/api/users" && request.method === "POST") {
          const body = await request.json();
          const identificador = String(body.identificador ?? "").trim().toLowerCase();
          const nombre = String(body.nombre ?? "").trim();
          const perfil = body.perfil === "administrador" ? "administrador" : body.perfil === "usuario" ? "usuario" : "";
          const password = typeof body.password === "string" ? body.password : "";
          if (!/^[a-z0-9][a-z0-9._-]{1,31}$/.test(identificador) || !nombre || !perfil || password.length < 16) return jsonResponse({ error: "Identificador, nombre, perfil y una contraseña de al menos 16 caracteres son obligatorios." }, 400);
          if (users.some((user) => user.identificador === identificador)) return jsonResponse({ error: "Ese identificador ya existe." }, 409);
          const user = { id: crypto.randomUUID(), identificador, nombre, perfil, activo: true, password: await hashPassword(password) };
          users.push(user);
          await this.ctx.storage.put("users", users);
          return jsonResponse(sanitize(user), 201);
        }
        const userId = decodeURIComponent(url.pathname.slice("/api/users/".length));
        const index = users.findIndex((user) => user.id === userId);
        if (index < 0) return jsonResponse({ error: "Usuario no encontrado." }, 404);
        if (request.method !== "PUT") return jsonResponse({ error: "MÃ©todo no permitido." }, 405);
        const body = await request.json();
        const currentUser = users[index];
        const next = { ...currentUser };
        if (body.nombre !== undefined) {
          const nombre = String(body.nombre).trim();
          if (!nombre) return jsonResponse({ error: "El nombre no puede estar vacío." }, 400);
          next.nombre = nombre;
        }
        if (body.perfil !== undefined) {
          if (!["administrador", "usuario"].includes(body.perfil)) return jsonResponse({ error: "Perfil no válido." }, 400);
          next.perfil = body.perfil;
        }
        if (body.activo !== undefined) next.activo = Boolean(body.activo);
        if (body.password !== undefined) {
          if (typeof body.password !== "string" || body.password.length < 16) return jsonResponse({ error: "La contraseña debe tener al menos 16 caracteres." }, 400);
          next.password = await hashPassword(body.password);
        }
        const activeAdmins = users.filter((user) => user.activo !== false && user.perfil === "administrador");
        if ((next.activo === false || next.perfil !== "administrador") && currentUser.perfil === "administrador" && activeAdmins.length === 1) return jsonResponse({ error: "Debe quedar al menos un administrador activo." }, 400);
        users[index] = next;
        await this.ctx.storage.put("users", users);
        return jsonResponse(sanitize(next));
      }
      if (request.method === "GET") {
        if (stored !== undefined) {
          const current = JSON.parse(stored);
          await this.ensureDailyBackup(current);
          return jsonResponse(current);
        }
        const initialized = await this.ctx.storage.transaction(async (transaction) => {
          const current = await transaction.get("json");
          if (current !== undefined) return JSON.parse(current);
          await transaction.put("json", JSON.stringify(seed));
          return seed;
        });
        await this.ensureDailyBackup(initialized);
        return jsonResponse(initialized);
      }
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_STATE_BYTES) {
        return jsonResponse({ error: "El JSON supera el límite de 2 MB." }, 413);
      }
      let input;
      try { input = JSON.parse(raw); } catch { return jsonResponse({ error: "JSON no válido." }, 400); }
      const currentStored = stored === undefined ? seed : JSON.parse(stored);
      if (request.method === "PUT" && sessionUser.perfil === "usuario") {
        const proposed = input.state;
        const same = (key) => JSON.stringify(currentStored[key] ?? []) === JSON.stringify(proposed[key] ?? []);
        const noDeletes = (key) => (currentStored[key] ?? []).every((entry) => (proposed[key] ?? []).some((next) => next.id === entry.id));
        const legacyRoute = !currentStored.rutasCompra && Array.isArray(proposed.rutasCompra) && proposed.rutasCompra.length === 1 && proposed.rutasCompra[0].id === "general" && JSON.stringify(proposed.rutasCompra[0].ordenTipoIds) === JSON.stringify(currentStored.tipos.map((type) => type.id));
        if ((!same("estancias") && !same("contenedores")) || (currentStored.rutasCompra && !same("rutasCompra")) || (!currentStored.rutasCompra && proposed.rutasCompra && !legacyRoute) || !noDeletes("tipos") || !noDeletes("productos")) {
          return jsonResponse({ error: "Tu perfil no permite modificar la estructura de ubicaciones, tiendas ni eliminar elementos del catálogo." }, 403);
        }
      }
      await this.ensureDailyBackup(currentStored);
      const result = await this.ctx.storage.transaction(async (transaction) => {
        const snapshot = await transaction.get("json");
        const current = snapshot === undefined ? seed : JSON.parse(snapshot);
        const changed = nextState(current, input.expectedRevision, input.state);
        if (changed === null) return null;
        await transaction.put("json", JSON.stringify(changed));
        return changed;
      });
      if (result === null) return jsonResponse({ error: "El inventario cambió. Actualiza y vuelve a intentarlo." }, 409);
      await this.recordHistory(currentStored, result);
      return jsonResponse(result);
    } catch (error) {
      if (error instanceof TypeError || error?.name === "DomainError") {
        return jsonResponse({ error: error.message }, 400);
      }
      return jsonResponse({ error: "Error al acceder al JSON compartido." }, 500);
    }
  }
}
