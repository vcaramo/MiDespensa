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
    compras: [],
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

function requireMinimum(value = 0) {
  if (!Number.isSafeInteger(value) || value < 0) throw new DomainError("El stock mínimo debe ser un número entero igual o mayor que cero.");
  return value;
}

export function createProducto(state, { id, tipoId, nombre, stockMinimo = 0 }) {
  requireId(id);
  findById(state.tipos, tipoId, "El tipo");
  if (state.productos.some((entry) => entry.id === id)) throw new DomainError("El identificador ya existe.");
  const name = cleanName(nombre);
  ensureUniqueName(state.productos, name, null, "un producto");
  const minimum = requireMinimum(stockMinimo);
  return { ...state, productos: [...state.productos, { id, tipoId, nombre: name, ...(minimum > 0 ? { stockMinimo: minimum } : {}) }] };
}

export function updateProducto(state, id, { tipoId, nombre, stockMinimo = 0 }) {
  findById(state.productos, id, "El producto");
  findById(state.tipos, tipoId, "El tipo");
  const name = cleanName(nombre);
  ensureUniqueName(state.productos, name, id, "un producto");
  return {
    ...state,
    productos: state.productos.map((entry) =>
      entry.id === id ? (() => { const minimum = requireMinimum(stockMinimo); const updated = { ...entry, tipoId, nombre: name }; if (minimum > 0) updated.stockMinimo = minimum; else delete updated.stockMinimo; return updated; })() : entry,
    ),
  };
}

export function applyMinimumRestock(state, productoId, id = crypto.randomUUID()) {
  const product = findById(state.productos, productoId, "El producto");
  const minimum = requireMinimum(product.stockMinimo ?? 0);
  if (minimum === 0) return state;
  const total = state.existencias.filter((entry) => entry.productoId === productoId).reduce((sum, entry) => sum + entry.cantidad, 0);
  const needed = minimum - total;
  if (needed <= 0) return state;
  const existing = state.compras.find((entry) => entry.productoId === productoId);
  if (existing) return { ...state, compras: state.compras.map((entry) => entry.id === existing.id ? { ...entry, cantidad: Math.max(entry.cantidad, needed) } : entry) };
  return { ...state, compras: [...state.compras, { id, productoId, cantidad: needed }] };
}

export function deleteProducto(state, id) {
  findById(state.productos, id, "El producto");
  if (state.existencias.some((entry) => entry.productoId === id)) {
    throw new DomainError("Retira las existencias de este producto antes de borrarlo.");
  }
  if (state.compras?.some((entry) => entry.productoId === id)) {
    throw new DomainError("Retira el producto de la lista de la compra antes de borrarlo.");
  }
  return { ...state, productos: state.productos.filter((entry) => entry.id !== id) };
}

function requireQuantity(cantidad) {
  if (!Number.isSafeInteger(cantidad) || cantidad <= 0) {
    throw new DomainError("La cantidad debe ser un número entero mayor que cero.");
  }
  return cantidad;
}

export function addStock(state, { id, productoId, contenedorId, cantidad }) {
  requireQuantity(cantidad);
  findById(state.productos, productoId, "El producto");
  if (contenedorId !== null) findById(state.contenedores, contenedorId, "El contenedor");
  const existing = state.existencias.find((entry) => entry.productoId === productoId && entry.contenedorId === contenedorId);
  if (existing) {
    const total = existing.cantidad + cantidad;
    if (!Number.isSafeInteger(total)) throw new DomainError("La cantidad total es demasiado grande.");
    return { ...state, existencias: state.existencias.map((entry) => entry.id === existing.id ? { ...entry, cantidad: total } : entry) };
  }
  requireId(id);
  if (state.existencias.some((entry) => entry.id === id)) throw new DomainError("El identificador ya existe.");
  return { ...state, existencias: [...state.existencias, { id, productoId, contenedorId, cantidad }] };
}

export function removeStock(state, { productoId, contenedorId, cantidad }) {
  requireQuantity(cantidad);
  const existing = state.existencias.find((entry) => entry.productoId === productoId && entry.contenedorId === contenedorId);
  if (!existing || existing.cantidad < cantidad) throw new DomainError("No hay suficientes unidades en este contenedor.");
  return { ...state, existencias: state.existencias.flatMap((entry) => entry.id !== existing.id ? [entry] : entry.cantidad === cantidad ? [] : [{ ...entry, cantidad: entry.cantidad - cantidad }]) };
}

export function consumeStock(state, { productoId, contenedorId, cantidad, shoppingId, shoppingQuantity = null }) {
  const remaining = removeStock(state, { productoId, contenedorId, cantidad });
  if (shoppingQuantity === null) return remaining;
  if (remaining.existencias.some((entry) => entry.productoId === productoId)) {
    throw new DomainError("Todavía quedan unidades de este producto en el inventario.");
  }
  return addShoppingItem(remaining, { id: shoppingId, productoId, cantidad: shoppingQuantity });
}

export function moveStock(state, { productoId, fromContainerId, toContainerId, cantidad, id }) {
  if (fromContainerId === toContainerId) throw new DomainError("Elige otro contenedor de destino.");
  const removed = removeStock(state, { productoId, contenedorId: fromContainerId, cantidad });
  return addStock(removed, { id, productoId, contenedorId: toContainerId, cantidad });
}

export function addShoppingItem(state, { id, productoId, cantidad }) {
  requireQuantity(cantidad);
  findById(state.productos, productoId, "El producto");
  const existing = state.compras.find((entry) => entry.productoId === productoId);
  if (existing) {
    const total = existing.cantidad + cantidad;
    if (!Number.isSafeInteger(total)) throw new DomainError("La cantidad total es demasiado grande.");
    return { ...state, compras: state.compras.map((entry) => entry.id === existing.id ? { ...entry, cantidad: total } : entry) };
  }
  requireId(id);
  if (state.compras.some((entry) => entry.id === id)) throw new DomainError("El identificador ya existe.");
  return { ...state, compras: [...state.compras, { id, productoId, cantidad }] };
}

export function removeShoppingItem(state, id) {
  findById(state.compras, id, "El producto de la lista");
  return { ...state, compras: state.compras.filter((entry) => entry.id !== id) };
}

export function completeShoppingItem(state, { itemId, contenedorId = null, cantidad, stockId }) {
  const item = findById(state.compras, itemId, "El producto de la lista");
  requireQuantity(cantidad);
  const stocked = addStock(state, { id: stockId, productoId: item.productoId, contenedorId, cantidad });
  return {
    ...stocked,
    compras: stocked.compras.flatMap((entry) => entry.id !== itemId ? [entry] : entry.cantidad <= cantidad ? [] : [{ ...entry, cantidad: entry.cantidad - cantidad }]),
  };
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
    productos: readCollection(input, "productos", (entry) => {
      const product = { id: requireId(entry.id), tipoId: requireId(entry.tipoId), nombre: cleanName(entry.nombre) };
      const minimum = entry.stockMinimo === undefined ? 0 : requireMinimum(entry.stockMinimo);
      if (minimum > 0) product.stockMinimo = minimum;
      return product;
    }),
    existencias: readCollection(input, "existencias", (entry) => ({
      id: requireId(entry.id),
      contenedorId: entry.contenedorId === null ? null : requireId(entry.contenedorId),
      productoId: requireId(entry.productoId),
      cantidad: entry.cantidad,
    })),
    compras: readCollection({ compras: input.compras === undefined ? [] : input.compras }, "compras", (entry) => ({
      id: requireId(entry.id),
      productoId: requireId(entry.productoId),
      cantidad: entry.cantidad,
    })),
  };
  if (input.rutasCompra !== undefined) {
    if (!Array.isArray(input.rutasCompra)) throw new DomainError("Las tiendas no son válidas.");
    state.rutasCompra = input.rutasCompra.map((route) => ({ id: requireId(route.id), nombre: cleanName(route.nombre), ordenTipoIds: Array.isArray(route.ordenTipoIds) ? route.ordenTipoIds.map(requireId) : [] }));
    ensureUniqueNames(state.rutasCompra, "tiendas");
  }

  const allIds = new Set();
  for (const key of ["estancias", "contenedores", "tipos", "productos", "existencias", "compras"]) {
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
    requireMinimum(entry.stockMinimo);
  }
  const pairs = new Set();
  for (const entry of state.existencias) {
    if ((entry.contenedorId !== null && !containerIds.has(entry.contenedorId)) || !productIds.has(entry.productoId)) {
      throw new DomainError("Una existencia tiene una referencia inexistente.");
    }
    if (!Number.isSafeInteger(entry.cantidad) || entry.cantidad <= 0) {
      throw new DomainError("Una existencia tiene una cantidad inválida.");
    }
    const pair = JSON.stringify([entry.contenedorId, entry.productoId]);
    if (pairs.has(pair)) throw new DomainError("Hay existencias duplicadas para un mismo producto y contenedor.");
    pairs.add(pair);
  }
  const shoppingProducts = new Set();
  for (const entry of state.compras) {
    if (!productIds.has(entry.productoId)) throw new DomainError("Un producto de la lista de la compra no existe en el catálogo.");
    requireQuantity(entry.cantidad);
    if (shoppingProducts.has(entry.productoId)) throw new DomainError("Hay productos duplicados en la lista de la compra.");
    shoppingProducts.add(entry.productoId);
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
