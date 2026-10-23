import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initialState, nextState } from "../worker/state.js";

const starter = JSON.parse(await readFile(new URL("../docs/catalogo-inicial.json", import.meta.url), "utf8"));

test("el servidor inicializa el catálogo y controla las revisiones", () => {
  const original = initialState(starter);
  assert.equal(original.productos.length, 100);
  assert.equal(original.revision, 0);

  const proposed = { ...original, estancias: [{ id: "estancia-prueba", nombre: "Cocina" }] };
  const saved = nextState(original, 0, proposed);
  assert.equal(saved.revision, 1);
  assert.equal(saved.estancias[0].nombre, "Cocina");
  assert.ok(saved.updatedAt);
  assert.equal(nextState(saved, 0, proposed), null);
  assert.deepEqual(original.estancias, []);
});

test("el servidor rechaza un JSON con referencias inválidas", () => {
  const original = initialState(starter);
  assert.throws(() => nextState(original, 0, {
    ...original,
    existencias: [{ id: "e1", productoId: "inexistente", contenedorId: null, cantidad: 1 }],
  }), /referencia inexistente/);
});
