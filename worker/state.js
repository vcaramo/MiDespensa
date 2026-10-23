import { validateState, withInitialCatalog, emptyState } from "../docs/src/domain.js";

export const MAX_STATE_BYTES = 2_000_000;

export function initialState(starter) {
  return validateState(withInitialCatalog(emptyState(), validateState(starter)));
}

export function nextState(current, expectedRevision, proposed) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new TypeError("La revisión solicitada no es válida.");
  }
  if (current.revision !== expectedRevision) return null;
  const candidate = validateState(proposed);
  return validateState({
    ...candidate,
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
  });
}

export function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
