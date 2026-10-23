import { validateState } from "./domain.js";

const API_URL = new URL("../api/state", import.meta.url);

export class RevisionConflictError extends Error {
  constructor() {
    super("Los datos cambiaron en otro dispositivo o pestaña. Se ha actualizado la vista; revisa el cambio antes de repetirlo.");
    this.name = "RevisionConflictError";
  }
}

async function readResponse(response) {
  if (response.status === 409) throw new RevisionConflictError();
  if (!response.ok) {
    let message = "No se pudo conectar con el servidor de datos.";
    try {
      const body = await response.json();
      if (typeof body.error === "string") message = body.error;
    } catch { /* La respuesta puede ser la página de inicio de sesión de Access. */ }
    throw new Error(message);
  }
  if (!response.headers.get("Content-Type")?.includes("application/json")) {
    throw new Error("El servidor no ha entregado el inventario. Comprueba tu sesión de Cloudflare Access.");
  }
  return validateState(await response.json());
}

export async function loadState() {
  const response = await fetch(API_URL, { cache: "no-store", credentials: "same-origin" });
  return readResponse(response);
}

export async function commitState(expectedRevision, transform) {
  const current = await loadState();
  if (current.revision !== expectedRevision) throw new RevisionConflictError();
  const proposed = validateState(transform(current));
  const response = await fetch(API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision, state: proposed }),
    cache: "no-store",
    credentials: "same-origin",
  });
  return readResponse(response);
}
