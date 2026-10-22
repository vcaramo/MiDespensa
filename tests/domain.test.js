import test from "node:test";
import assert from "node:assert/strict";
import {
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
  parseImportJson,
  renameContenedor,
  renameEstancia,
  renameTipo,
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
