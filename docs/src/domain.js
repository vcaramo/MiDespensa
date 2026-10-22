export const SCHEMA_VERSION = 1;

export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = "DomainError";
  }
}

export function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    updatedAt: null,
    estancias: [],
    contenedores: [],
    tipos: [],
    productos: [],
    existencias: [],
  };
}

export function withInitialCatalog(state, starter) {
  if (state.tipos.length || state.productos.length) return state;
  return {
    ...state,
    tipos: starter.tipos.map((entry) => ({ ...entry })),
    productos: starter.productos.map((entry) => ({ ...entry })),
  };
}

export function cleanName(value) {
  if (typeof value !== "string") throw new DomainError("Escribe un nombre válido.");
  const name = value.trim().replace(/\s+/gu, " ");
  if (!name) throw new DomainError("El nombre no puede estar vacío.");
  if (name.length > 80) throw new DomainError("El nombre no puede superar 80 caracteres.");
  return name;
}

export function canonicalName(value) {
  return cleanName(value).toLocaleLowerCase("es");
}

function requireId(id) {
  if (typeof id !== "string" || !id.trim()) {
    throw new DomainError("El identificador no es válido.");
  }
  return id;
}

function findById(items, id, label) {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new DomainError(`${label} no existe.`);
  return item;
}

function ensureUniqueName(items, name, exceptId, label) {
  const canonical = canonicalName(name);
  if (items.some((entry) => entry.id !== exceptId && canonicalName(entry.nombre) === canonical)) {
    throw new DomainError(`Ya existe ${label} con ese nombre.`);
  }
}

export function createEstancia(state, { id, nombre }) {
  requireId(id);
  const name = cleanName(nombre);
  if (state.estancias.some((entry) => entry.id === id)) throw new DomainError("El identificador ya existe.");
  ensureUniqueName(state.estancias, name, null, "una estancia");
  return { ...state, estancias: [...state.estancias, { id, nombre: name }] };
}

export function renameEstancia(state, id, nombre) {
  findById(state.estancias, id, "La estancia");
  const name = cleanName(nombre);
  ensureUniqueName(state.estancias, name, id, "una estancia");
  return {
    ...state,
    estancias: state.estancias.map((entry) =>
      entry.id === id ? { ...entry, nombre: name } : entry,
    ),
  };
}

export function deleteEstancia(state, id) {
  findById(state.estancias, id, "La estancia");
  const containerIds = new Set(
    state.contenedores.filter((entry) => entry.estanciaId === id).map((entry) => entry.id),
  );
  if (state.existencias.some((entry) => containerIds.has(entry.contenedorId))) {
    throw new DomainError("Retira o traslada las existencias de sus contenedores antes de borrar la estancia.");
  }
  return {
    ...state,
    estancias: state.estancias.filter((entry) => entry.id !== id),
    contenedores: state.contenedores.filter((entry) => entry.estanciaId !== id),
  };
}

function containersInRoom(state, estanciaId) {
  return state.contenedores.filter((entry) => entry.estanciaId === estanciaId);
}

export function createContenedor(state, { id, estanciaId, nombre }) {
  requireId(id);
  findById(state.estancias, estanciaId, "La estancia");
  if (state.contenedores.some((entry) => entry.id === id)) throw new DomainError("El identificador ya existe.");
  const name = cleanName(nombre);
  ensureUniqueName(containersInRoom(state, estanciaId), name, null, "un contenedor en esta estancia");
  return {
    ...state,
    contenedores: [...state.contenedores, { id, estanciaId, nombre: name }],
  };
}

export function renameContenedor(state, id, nombre) {
  const container = findById(state.contenedores, id, "El contenedor");
  const name = cleanName(nombre);
  ensureUniqueName(containersInRoom(state, container.estanciaId), name, id, "un contenedor en esta estancia");
  return {
    ...state,
    contenedores: state.contenedores.map((entry) =>
      entry.id === id ? { ...entry, nombre: name } : entry,
    ),
  };
}

export function moveContenedor(state, id, estanciaId) {
  const container = findById(state.contenedores, id, "El contenedor");
  findById(state.estancias, estanciaId, "La estancia de destino");
  ensureUniqueName(containersInRoom(state, estanciaId), container.nombre, id, "un contenedor en la estancia de destino");
  return {
    ...state,
    contenedores: state.contenedores.map((entry) =>
      entry.id === id ? { ...entry, estanciaId } : entry,
    ),
  };
}

export function deleteContenedor(state, id) {
  findById(state.contenedores, id, "El contenedor");
  if (state.existencias.some((entry) => entry.contenedorId === id)) {
    throw new DomainError("Retira o traslada sus existencias antes de borrar el contenedor.");
  }
  return { ...state, contenedores: state.contenedores.filter((entry) => entry.id !== id) };
}

export function createTipo(state, { id, nombre }) {
  requireId(id);
  if (state.tipos.some((entry) => entry.id === id)) throw new DomainError("El identificador ya existe.");
  const name = cleanName(nombre);
  ensureUniqueName(state.tipos, name, null, "un tipo");
  return { ...state, tipos: [...state.tipos, { id, nombre: name }] };
}

export function renameTipo(state, id, nombre) {
  findById(state.tipos, id, "El tipo");
  const name = cleanName(nombre);
  ensureUniqueName(state.tipos, name, id, "un tipo");
  return {
    ...state,
    tipos: state.tipos.map((entry) => entry.id === id ? { ...entry, nombre: name } : entry),
  };
}

export function deleteTipo(state, id) {
  findById(state.tipos, id, "El tipo");
  if (state.productos.some((entry) => entry.tipoId === id)) {
    throw new DomainError("Mueve o elimina los productos de este tipo antes de borrarlo.");
  }
  return { ...state, tipos: state.tipos.filter((entry) => entry.id !== id) };
}

export function createProducto(state, { id, tipoId, nombre }) {
  requireId(id);
  findById(state.tipos, tipoId, "El tipo");
  if (state.productos.some((entry) => entry.id === id)) throw new DomainError("El identificador ya existe.");
  const name = cleanName(nombre);
  ensureUniqueName(state.productos, name, null, "un producto");
  return { ...state, productos: [...state.productos, { id, tipoId, nombre: name }] };
}

export function updateProducto(state, id, { tipoId, nombre }) {
  findById(state.productos, id, "El producto");
  findById(state.tipos, tipoId, "El tipo");
  const name = cleanName(nombre);
  ensureUniqueName(state.productos, name, id, "un producto");
  return {
    ...state,
    productos: state.productos.map((entry) =>
      entry.id === id ? { ...entry, tipoId, nombre: name } : entry,
    ),
  };
}

export function deleteProducto(state, id) {
  findById(state.productos, id, "El producto");
  if (state.existencias.some((entry) => entry.productoId === id)) {
    throw new DomainError("Retira las existencias de este producto antes de borrarlo.");
  }
  return { ...state, productos: state.productos.filter((entry) => entry.id !== id) };
}

function readCollection(input, key, mapEntry) {
  if (!Array.isArray(input[key])) throw new DomainError(`La colección «${key}» no es válida.`);
  return input[key].map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new DomainError(`Hay un elemento inválido en «${key}».`);
    }
    return mapEntry(entry);
  });
}

function ensureUniqueIds(items, label, allIds) {
  for (const item of items) {
    requireId(item.id);
    if (allIds.has(item.id)) throw new DomainError(`Hay un identificador duplicado en ${label}.`);
    allIds.add(item.id);
  }
}

function ensureUniqueNames(items, label, scope = () => "") {
  const seen = new Set();
  for (const item of items) {
    const key = `${scope(item)}\u0000${canonicalName(item.nombre)}`;
    if (seen.has(key)) throw new DomainError(`Hay nombres duplicados en ${label}.`);
    seen.add(key);
  }
}

export function validateState(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new DomainError("El archivo no contiene un inventario válido.");
  }
  if (input.schemaVersion !== SCHEMA_VERSION) {
    throw new DomainError("La versión del archivo JSON no es compatible.");
  }
  const revision = input.revision ?? 0;
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new DomainError("La revisión de los datos no es válida.");
  }
  const updatedAt = input.updatedAt ?? null;
  if (updatedAt !== null && (typeof updatedAt !== "string" || Number.isNaN(Date.parse(updatedAt)))) {
    throw new DomainError("La fecha de actualización no es válida.");
  }

  const state = {
    schemaVersion: SCHEMA_VERSION,
    revision,
    updatedAt,
    estancias: readCollection(input, "estancias", (entry) => ({ id: requireId(entry.id), nombre: cleanName(entry.nombre) })),
    contenedores: readCollection(input, "contenedores", (entry) => ({
      id: requireId(entry.id),
      estanciaId: requireId(entry.estanciaId),
      nombre: cleanName(entry.nombre),
    })),
    tipos: readCollection(input, "tipos", (entry) => ({ id: requireId(entry.id), nombre: cleanName(entry.nombre) })),
    productos: readCollection(input, "productos", (entry) => ({
      id: requireId(entry.id),
      tipoId: requireId(entry.tipoId),
      nombre: cleanName(entry.nombre),
    })),
    existencias: readCollection(input, "existencias", (entry) => ({
      id: requireId(entry.id),
      contenedorId: requireId(entry.contenedorId),
      productoId: requireId(entry.productoId),
      cantidad: entry.cantidad,
    })),
  };

  const allIds = new Set();
  for (const key of ["estancias", "contenedores", "tipos", "productos", "existencias"]) {
    ensureUniqueIds(state[key], key, allIds);
  }
  ensureUniqueNames(state.estancias, "estancias");
  ensureUniqueNames(state.tipos, "tipos");
  ensureUniqueNames(state.productos, "productos");
  ensureUniqueNames(state.contenedores, "contenedores", (entry) => entry.estanciaId);

  const roomIds = new Set(state.estancias.map((entry) => entry.id));
  const containerIds = new Set(state.contenedores.map((entry) => entry.id));
  const typeIds = new Set(state.tipos.map((entry) => entry.id));
  const productIds = new Set(state.productos.map((entry) => entry.id));
  for (const entry of state.contenedores) {
    if (!roomIds.has(entry.estanciaId)) throw new DomainError("Un contenedor referencia una estancia inexistente.");
  }
  for (const entry of state.productos) {
    if (!typeIds.has(entry.tipoId)) throw new DomainError("Un producto referencia un tipo inexistente.");
  }
  const pairs = new Set();
  for (const entry of state.existencias) {
    if (!containerIds.has(entry.contenedorId) || !productIds.has(entry.productoId)) {
      throw new DomainError("Una existencia tiene una referencia inexistente.");
    }
    if (!Number.isSafeInteger(entry.cantidad) || entry.cantidad <= 0) {
      throw new DomainError("Una existencia tiene una cantidad inválida.");
    }
    const pair = `${entry.contenedorId}\u0000${entry.productoId}`;
    if (pairs.has(pair)) throw new DomainError("Hay existencias duplicadas para un mismo producto y contenedor.");
    pairs.add(pair);
  }
  return state;
}

export function parseImportJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DomainError("El archivo no contiene JSON válido.");
  }
  return validateState(parsed);
}
