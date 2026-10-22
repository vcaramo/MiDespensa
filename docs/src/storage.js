import { emptyState, parseImportJson, validateState, withInitialCatalog } from "./domain.js";

const DATABASE_NAME = "despensa-personal";
const STORE_NAME = "documentos";
const STATE_KEY = "inventario";
const STARTER_KEY = "catalogo-inicial-aplicado-v1";
const STARTER_URL = new URL("../catalogo-inicial.json", import.meta.url);
let databasePromise;

export class RevisionConflictError extends Error {
  constructor() {
    super("Los datos cambiaron en otra pestaña. Recarga la página antes de guardar.");
    this.name = "RevisionConflictError";
  }
}

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return databasePromise;
}

async function readSnapshot(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const stateRequest = store.get(STATE_KEY);
    const starterRequest = store.get(STARTER_KEY);
    transaction.oncomplete = () => {
      try {
        resolve({
          state: stateRequest.result ? validateState(stateRequest.result) : emptyState(),
          exists: Boolean(stateRequest.result),
          applied: starterRequest.result === true,
        });
      } catch (error) {
        reject(error);
      }
    };
    transaction.onabort = () => reject(transaction.error ?? new Error("No se pudieron leer los datos."));
  });
}

async function applyStarter(db, starter) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const stateRequest = store.get(STATE_KEY);
    const starterRequest = store.get(STARTER_KEY);
    let completed = 0;
    let nextState;
    let failure;
    const apply = () => {
      if (++completed !== 2) return;
      try {
        const current = stateRequest.result ? validateState(stateRequest.result) : emptyState();
        nextState = current;
        if (starterRequest.result !== true) {
          if (starter && current.tipos.length === 0 && current.productos.length === 0) {
            const merged = withInitialCatalog(current, starter);
            nextState = stateRequest.result
              ? { ...merged, revision: current.revision + 1, updatedAt: new Date().toISOString() }
              : merged;
            store.put(validateState(nextState), STATE_KEY);
          }
          store.put(true, STARTER_KEY);
        }
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    stateRequest.onsuccess = apply;
    starterRequest.onsuccess = apply;
    transaction.oncomplete = () => resolve(nextState);
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("No se pudo preparar el catálogo inicial."));
  });
}

export async function loadState() {
  const db = await openDatabase();
  const snapshot = await readSnapshot(db);
  if (snapshot.applied) return snapshot.state;
  if (snapshot.state.tipos.length || snapshot.state.productos.length) {
    return applyStarter(db, null);
  }
  let starter;
  try {
    const response = await fetch(STARTER_URL);
    if (!response.ok) throw new Error("No se pudo descargar el catálogo inicial.");
    starter = parseImportJson(await response.text());
  } catch (error) {
    if (snapshot.exists) return snapshot.state;
    throw error;
  }
  return applyStarter(db, starter);
}

export async function commitState(expectedRevision, transform) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(STATE_KEY);
    let nextState;
    let failure;

    request.onsuccess = () => {
      try {
        const current = request.result ? validateState(request.result) : emptyState();
        if (current.revision !== expectedRevision) throw new RevisionConflictError();
        const changed = validateState(transform(current));
        nextState = {
          ...changed,
          revision: current.revision + 1,
          updatedAt: new Date().toISOString(),
        };
        store.put(nextState, STATE_KEY);
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    request.onerror = () => {
      failure = request.error;
    };
    transaction.oncomplete = () => resolve(nextState);
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("No se pudieron guardar los datos."));
    transaction.onerror = () => {
      failure ??= transaction.error;
    };
  });
}
