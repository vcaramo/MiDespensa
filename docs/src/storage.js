import { validateState } from "./domain.js";

const API_URL = new URL("../api/state", import.meta.url);
const HEALTH_URL = new URL("../api/health", import.meta.url);
let password = null;

export class AuthenticationError extends Error {
  constructor() {
    super("Introduce la contraseña de MiDespensa.");
    this.name = "AuthenticationError";
  }
}

export class RevisionConflictError extends Error {
  constructor() {
    super("Los datos cambiaron en otro dispositivo o pestaña. Se ha actualizado la vista; revisa el cambio antes de repetirlo.");
    this.name = "RevisionConflictError";
  }
}

export function setPassword(value) {
  password = typeof value === "string" && value ? value : null;
}

export function hasPassword() {
  return password !== null;
}

export async function login(identifier, value) {
  const response = await fetch(new URL("../api/auth/login", import.meta.url), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identificador: identifier, password: value }) });
  if (response.status === 401) throw new AuthenticationError();
  if (!response.ok) throw new Error("El servidor de acceso ha fallado. Vuelve a intentarlo más tarde.");
  return response.json();
}

async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers);
  if (password) headers.set("X-Despensa-Password", encodeURIComponent(password));
  const response = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
    credentials: "include",
  });
  if (response.status === 401) throw new AuthenticationError();
  return response;
}

async function readResponse(response) {
  if (response.status === 409) throw new RevisionConflictError();
  if (!response.ok) {
    let message = "No se pudo conectar con el servidor de datos.";
    try {
      const body = await response.json();
      if (typeof body.error === "string") message = body.error;
    } catch { /* La respuesta puede no ser JSON. */ }
    throw new Error(message);
  }
  if (!response.headers.get("Content-Type")?.includes("application/json")) {
    throw new Error("El servidor no ha entregado el inventario.");
  }
  return validateState(await response.json());
}

export async function checkServer() {
  const response = await apiFetch(HEALTH_URL);
  return response.ok && (await response.text()).trim() === "despensa-ok";
}

export async function loadState() {
  return readResponse(await apiFetch(API_URL));
}

export async function listBackups() {
  const response = await apiFetch(new URL("../api/backups", import.meta.url));
  if (!response.ok) throw new Error("No se pudieron consultar las copias automáticas.");
  return response.json();
}

export async function loadBackup(date) {
  const response = await apiFetch(new URL(`../api/backups/${encodeURIComponent(date)}`, import.meta.url));
  return readResponse(response);
}

export async function listHistory() {
  const response = await apiFetch(new URL("../api/history", import.meta.url));
  if (!response.ok) throw new Error("No se pudo consultar el historial.");
  return response.json();
}

async function readJsonResponse(response) {
  if (!response.ok) {
    let message = "No se pudo completar la operación.";
    try { const body = await response.json(); if (typeof body.error === "string") message = body.error; } catch { /* respuesta no JSON */ }
    throw new Error(message);
  }
  return response.json();
}

export async function listUsers() {
  return readJsonResponse(await apiFetch(new URL("../api/users", import.meta.url)));
}

export async function createUser(input) {
  return readJsonResponse(await apiFetch(new URL("../api/users", import.meta.url), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }));
}

export async function updateUser(id, input) {
  return readJsonResponse(await apiFetch(new URL(`../api/users/${encodeURIComponent(id)}`, import.meta.url), {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }));
}

export async function lookupProduct(code) {
  const response = await apiFetch(new URL(`../api/product/${encodeURIComponent(code)}`, import.meta.url));
  if (!response.ok) throw new Error("No se pudo consultar la base de productos.");
  return response.json();
}

export async function commitState(expectedRevision, transform) {
  const current = await loadState();
  if (current.revision !== expectedRevision) throw new RevisionConflictError();
  const proposed = validateState(transform(current));
  const response = await apiFetch(API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision, state: proposed }),
  });
  return readResponse(response);
}
