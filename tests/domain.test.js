import test from "node:test";
import assert from "node:assert/strict";
import {
  addShoppingItem,
  addStock,
  completeShoppingItem,
  createContenedor,
  createEstancia,
  createProducto,
  createTipo,
  deleteContenedor,
  deleteEstancia,
  deleteProducto,
  deleteTipo,
  emptyState,
  moveContenedor,
  moveStock,
  parseImportJson,
  renameContenedor,
  renameEstancia,
  renameTipo,
  removeShoppingItem,
  removeStock,
  updateProducto,
  withInitialCatalog,
  validateState,
} from "../docs/src/domain.js";

function exampleState() {
  let state = emptyState();
  state = createEstancia(state, { id: "cocina", nombre: "Cocina" });
  state = createEstancia(state, { id: "despensa", nombre: "Despensa" });
  state = createContenedor(state, { id: "nevera", estanciaId: "cocina", nombre: "Nevera" });
  state = createContenedor(state, { id: "armario", estanciaId: "cocina", nombre: "Armario" });
  state = createContenedor(state, { id: "estanteria", estanciaId: "despensa", nombre: "Estantería" });
  return state;
}

test("organiza estancias y contenedores y conserva sus ID al renombrar y mover", () => {
  let state = exampleState();
  state = renameEstancia(state, "cocina", "Cocina principal");
  state = renameContenedor(state, "nevera", "Nevera grande");
  state = moveContenedor(state, "armario", "despensa");
  assert.deepEqual(state.estancias.find((item) => item.id === "cocina"), {
    id: "cocina", nombre: "Cocina principal",
  });
  assert.deepEqual(state.contenedores.find((item) => item.id === "nevera"), {
    id: "nevera", estanciaId: "cocina", nombre: "Nevera grande",
  });
  assert.deepEqual(state.contenedores.find((item) => item.id === "armario"), {
    id: "armario", estanciaId: "despensa", nombre: "Armario",
  });
  assert.equal(validateState(state).contenedores.length, 3);
});

test("entradas, salidas y traslados mantienen una sola existencia por producto y contenedor", () => {
  let state = createProducto(createTipo(exampleState(), { id: "tipo", nombre: "Lácteos" }), { id: "leche", tipoId: "tipo", nombre: "Leche" });
  state = addStock(state, { id: "stock1", productoId: "leche", contenedorId: "nevera", cantidad: 4 });
  state = addStock(state, { id: "sin-uso", productoId: "leche", contenedorId: "nevera", cantidad: 3 });
  assert.equal(state.existencias.length, 1);
  assert.equal(state.existencias[0].cantidad, 7);
  assert.throws(() => removeStock(state, { productoId: "leche", contenedorId: "nevera", cantidad: 8 }), /suficientes/);
  state = moveStock(state, { id: "stock2", productoId: "leche", fromContainerId: "nevera", toContainerId: "armario", cantidad: 2 });
  assert.deepEqual(state.existencias.map((entry) => entry.cantidad), [5, 2]);
  state = removeStock(state, { productoId: "leche", contenedorId: "armario", cantidad: 2 });
  assert.equal(state.existencias.length, 1);
  assert.throws(() => moveStock(state, { id: "stock3", productoId: "leche", fromContainerId: "nevera", toContainerId: "nevera", cantidad: 1 }), /otro contenedor/);
  assert.equal(validateState(state).existencias[0].cantidad, 5);
});

test("la compra agrega cantidades, permite recepción parcial y protege el producto", () => {
  let state = createProducto(createTipo(exampleState(), { id: "tipo", nombre: "Lácteos" }), { id: "leche", tipoId: "tipo", nombre: "Leche" });
  state = addShoppingItem(state, { id: "compra", productoId: "leche", cantidad: 3 });
  state = addShoppingItem(state, { id: "sin-uso", productoId: "leche", cantidad: 2 });
  assert.deepEqual(state.compras, [{ id: "compra", productoId: "leche", cantidad: 5 }]);
  assert.throws(() => deleteProducto(state, "leche"), /lista de la compra/);
  state = completeShoppingItem(state, { itemId: "compra", contenedorId: "nevera", cantidad: 2, stockId: "stock" });
  assert.equal(state.compras[0].cantidad, 3);
  assert.equal(state.existencias[0].cantidad, 2);
  state = completeShoppingItem(state, { itemId: "compra", contenedorId: "nevera", cantidad: 3, stockId: "sin-uso" });
  assert.equal(state.compras.length, 0);
  assert.equal(state.existencias[0].cantidad, 5);
  assert.deepEqual(parseImportJson(JSON.stringify(state)), state);
});

test("permite comprar más unidades que las apuntadas y registra la cantidad real", () => {
  let state = createProducto(createTipo(emptyState(), { id: "tipo", nombre: "Lácteos" }), { id: "leche", tipoId: "tipo", nombre: "Leche" });
  state = addShoppingItem(state, { id: "compra", productoId: "leche", cantidad: 2 });
  state = completeShoppingItem(state, { itemId: "compra", cantidad: 5, stockId: "stock" });
  assert.deepEqual(state.compras, []);
  assert.deepEqual(state.existencias, [{ id: "stock", productoId: "leche", contenedorId: null, cantidad: 5 }]);
  assert.deepEqual(parseImportJson(JSON.stringify(state)), state);
});

test("una compra entra sin contenedor y se puede asignar más tarde", () => {
  let state = createProducto(createTipo(emptyState(), { id: "tipo", nombre: "Lácteos" }), { id: "leche", tipoId: "tipo", nombre: "Leche" });
  state = addShoppingItem(state, { id: "compra", productoId: "leche", cantidad: 4 });
  state = completeShoppingItem(state, { itemId: "compra", cantidad: 4, stockId: "pendiente" });
  assert.deepEqual(state.existencias, [{ id: "pendiente", productoId: "leche", contenedorId: null, cantidad: 4 }]);
  assert.equal(state.compras.length, 0);
  assert.deepEqual(parseImportJson(JSON.stringify(state)), state);

  state = createEstancia(state, { id: "cocina", nombre: "Cocina" });
  state = createContenedor(state, { id: "nevera", estanciaId: "cocina", nombre: "Nevera" });
  state = moveStock(state, { id: "asignada", productoId: "leche", fromContainerId: null, toContainerId: "nevera", cantidad: 3 });
  assert.deepEqual(state.existencias.map((entry) => [entry.contenedorId, entry.cantidad]), [[null, 1], ["nevera", 3]]);
  state = moveStock(state, { id: "sin-uso", productoId: "leche", fromContainerId: null, toContainerId: "nevera", cantidad: 1 });
  assert.deepEqual(state.existencias, [{ id: "asignada", productoId: "leche", contenedorId: "nevera", cantidad: 4 }]);
  assert.equal(validateState(state).existencias.length, 1);
});

test("las copias anteriores se importan con lista vacía y los datos nuevos se validan", () => {
  const oldCopy = exampleState();
  delete oldCopy.compras;
  assert.deepEqual(parseImportJson(JSON.stringify(oldCopy)).compras, []);
  const state = createProducto(createTipo(exampleState(), { id: "tipo", nombre: "Lácteos" }), { id: "leche", tipoId: "tipo", nombre: "Leche" });
  assert.throws(() => validateState({ ...state, compras: [{ id: "compra", productoId: "otro", cantidad: 1 }] }), /no existe/);
  assert.throws(() => validateState({ ...state, compras: [{ id: "compra", productoId: "leche", cantidad: -1 }] }), /cantidad/);
  assert.deepEqual(removeShoppingItem(addShoppingItem(state, { id: "compra", productoId: "leche", cantidad: 1 }), "compra").compras, []);
});

test("impide nombres duplicados en una estancia y en su destino", () => {
  let state = exampleState();
  assert.throws(() => createEstancia(state, { id: "otra", nombre: " cocina " }), /Ya existe/);
  assert.throws(() => createContenedor(state, {
    id: "otra", estanciaId: "cocina", nombre: " NEVERA ",
  }), /Ya existe/);
  state = createContenedor(state, { id: "otra", estanciaId: "despensa", nombre: "Nevera" });
  assert.throws(() => moveContenedor(state, "nevera", "despensa"), /Ya existe/);
});

test("elimina en cascada una estancia y sus contenedores vacíos", () => {
  let state = exampleState();
  state = deleteEstancia(state, "cocina");
  assert.deepEqual(state.estancias.map((item) => item.id), ["despensa"]);
  assert.deepEqual(state.contenedores.map((item) => item.id), ["estanteria"]);
  assert.equal(validateState(state).contenedores.length, 1);
});

test("bloquea el borrado en cascada si un contenedor tiene existencias", () => {
  let state = exampleState();
  state = {
    ...state,
    tipos: [{ id: "lacteos", nombre: "Lácteos" }],
    productos: [{ id: "leche", tipoId: "lacteos", nombre: "Leche entera" }],
    existencias: [{ id: "stock", contenedorId: "nevera", productoId: "leche", cantidad: 2 }],
  };
  assert.throws(() => deleteEstancia(state, "cocina"), /Retira o traslada/);
  assert.throws(() => deleteContenedor(state, "nevera"), /Retira o traslada/);
  state = { ...state, existencias: [] };
  state = deleteEstancia(state, "cocina");
  assert.equal(state.estancias.length, 1);
  assert.equal(state.contenedores.length, 1);
});

test("exportación JSON e importación recuperan estructura y relaciones", () => {
  const state = exampleState();
  const restored = parseImportJson(JSON.stringify({ ...state, exportedAt: new Date().toISOString() }));
  assert.deepEqual(restored, state);
});

test("rechaza JSON corrupto y referencias o cantidades inválidas", () => {
  assert.throws(() => parseImportJson("{"), /JSON válido/);
  const state = exampleState();
  assert.throws(() => parseImportJson(JSON.stringify({ ...state, schemaVersion: 99 })), /versión/);
  assert.throws(() => validateState({ ...state, contenedores: [{
    id: "nevera", estanciaId: "inexistente", nombre: "Nevera",
  }] }), /estancia inexistente/);
  const withProduct = {
    ...state,
    tipos: [{ id: "tipo", nombre: "Lácteos" }],
    productos: [{ id: "producto", tipoId: "tipo", nombre: "Leche" }],
    existencias: [{ id: "existencia", productoId: "producto", contenedorId: "nevera", cantidad: -1 }],
  };
  assert.throws(() => validateState(withProduct), /cantidad inválida/);
});

test("crea tipos y productos sin existencias y conserva sus relaciones al cambiar nombres y tipo", () => {
  let state = emptyState();
  state = createTipo(state, { id: "lacteos", nombre: "Lácteos" });
  state = createTipo(state, { id: "conservas", nombre: "Conservas" });
  state = createProducto(state, { id: "leche", tipoId: "lacteos", nombre: "Leche entera" });
  state = createProducto(state, { id: "atun", tipoId: "conservas", nombre: "Atún en conserva" });
  state = renameTipo(state, "lacteos", "Lácteos y bebidas");
  assert.equal(state.productos.find((item) => item.id === "leche").tipoId, "lacteos");
  state = updateProducto(state, "atun", { tipoId: "lacteos", nombre: "Atún en aceite" });
  assert.deepEqual(state.productos.find((item) => item.id === "atun"), {
    id: "atun", tipoId: "lacteos", nombre: "Atún en aceite",
  });
  assert.equal(state.existencias.length, 0);
  assert.deepEqual(parseImportJson(JSON.stringify(state)), validateState(state));
});

test("impide duplicados del catálogo y protege tipos y productos referenciados", () => {
  let state = emptyState();
  state = createTipo(state, { id: "lacteos", nombre: "Lácteos" });
  state = createTipo(state, { id: "conservas", nombre: "Conservas" });
  state = createProducto(state, { id: "leche", tipoId: "lacteos", nombre: "Leche entera" });
  assert.throws(() => createTipo(state, { id: "duplicado", nombre: " LÁCTEOS " }), /Ya existe/);
  assert.throws(() => createProducto(state, { id: "duplicado", tipoId: "conservas", nombre: "  LECHE   ENTERA " }), /Ya existe/);
  assert.throws(() => deleteTipo(state, "lacteos"), /productos/);
  const withStock = {
    ...state,
    existencias: [{ id: "stock", contenedorId: "nevera", productoId: "leche", cantidad: 2 }],
  };
  assert.throws(() => deleteProducto(withStock, "leche"), /existencias/);
  state = deleteProducto(state, "leche");
  state = deleteTipo(state, "lacteos");
  assert.equal(state.productos.length, 0);
  assert.equal(state.tipos.length, 1);
});

test("el catálogo inicial conserva ubicaciones y no sustituye uno propio", () => {
  const starter = {
    ...emptyState(),
    tipos: [{ id: "tipo-inicial", nombre: "Despensa seca" }],
    productos: [{ id: "producto-inicial", tipoId: "tipo-inicial", nombre: "Arroz" }],
  };
  const locations = exampleState();
  const merged = validateState(withInitialCatalog(locations, starter));
  assert.deepEqual(merged.estancias, locations.estancias);
  assert.deepEqual(merged.contenedores, locations.contenedores);
  assert.equal(merged.productos.length, 1);
  assert.deepEqual(withInitialCatalog(merged, starter), merged);
  const custom = createProducto(createTipo(locations, { id: "custom", nombre: "Propio" }), {
    id: "producto-custom", tipoId: "custom", nombre: "Producto propio",
  });
  assert.deepEqual(withInitialCatalog(custom, starter), custom);
});
