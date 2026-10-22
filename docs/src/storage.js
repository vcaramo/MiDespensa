import { emptyState, validateState } from "./domain.js";

const DATABASE_NAME = "despensa-personal";
const STORE_NAME = "documentos";
const STATE_KEY = "inventario";
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

export async function loadState() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => {
      try {
        resolve(request.result ? validateState(request.result) : emptyState());
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
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
