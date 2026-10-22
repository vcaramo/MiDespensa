import { writeFile } from "node:fs/promises";
import { emptyState, validateState } from "../docs/src/domain.js";

const groups = [
  ["despensa-seca", "Despensa seca", [
    "Arroz redondo", "Arroz integral", "Macarrones", "Espaguetis", "Fideos",
    "Harina de trigo", "Harina de maíz", "Azúcar blanco", "Azúcar moreno", "Sal fina",
    "Aceite de oliva virgen extra", "Aceite de girasol", "Vinagre de vino", "Pan rallado",
    "Copos de avena", "Cereales de desayuno", "Galletas María", "Café molido",
  ]],
  ["conservas", "Conservas y tarros", [
    "Tomate triturado", "Tomate frito", "Atún al natural", "Atún en aceite de oliva",
    "Sardinas en lata", "Garbanzos cocidos", "Lentejas cocidas", "Alubias cocidas",
    "Maíz dulce", "Guisantes en conserva", "Aceitunas verdes", "Mermelada de fresa",
  ]],
  ["lacteos", "Lácteos, alternativas y huevos", [
    "Leche entera", "Leche semidesnatada", "Leche desnatada", "Bebida de avena",
    "Yogur natural", "Yogur de sabores", "Queso fresco", "Queso curado", "Mantequilla", "Huevos",
  ]],
  ["frutas-verduras", "Frutas y verduras", [
    "Manzanas", "Plátanos", "Naranjas", "Limones", "Peras", "Tomates frescos", "Lechuga",
    "Zanahorias", "Cebollas", "Patatas", "Ajos", "Pimientos verdes", "Calabacín", "Brócoli",
  ]],
  ["frescos", "Carnes, pescados y frescos", [
    "Pollo fresco", "Carne picada de ternera", "Jamón cocido", "Jamón serrano",
    "Salchichas frescas", "Filetes de merluza frescos", "Salmón fresco", "Tofu",
  ]],
  ["congelados", "Congelados", [
    "Verduras congeladas", "Guisantes congelados", "Patatas fritas congeladas",
    "Pizza congelada", "Croquetas congeladas", "Helado de vainilla",
    "Filetes de merluza congelados", "Pan congelado",
  ]],
  ["panaderia", "Panadería y repostería", [
    "Barra de pan", "Pan de molde", "Tortillas de trigo", "Tostadas",
    "Bollos de desayuno", "Levadura de panadería",
  ]],
  ["bebidas", "Bebidas", [
    "Agua mineral", "Agua con gas", "Zumo de naranja", "Refresco de cola",
    "Té negro", "Infusión de manzanilla",
  ]],
  ["limpieza", "Limpieza del hogar", [
    "Lavavajillas a mano", "Pastillas para lavavajillas", "Limpiador multiusos", "Lejía",
    "Limpiacristales", "Bolsas de basura", "Papel de cocina", "Bayetas",
  ]],
  ["lavanderia", "Lavandería", [
    "Detergente para ropa", "Suavizante", "Quitamanchas", "Pinzas para ropa",
  ]],
  ["higiene", "Higiene personal", [
    "Papel higiénico", "Jabón de manos", "Gel de ducha", "Champú",
    "Pasta de dientes", "Desodorante",
  ]],
];

const state = emptyState();
for (const [slug, nombre, names] of groups) {
  const tipoId = `tipo-${slug}`;
  state.tipos.push({ id: tipoId, nombre });
  for (const productName of names) {
    const id = `producto-${String(state.productos.length + 1).padStart(3, "0")}`;
    state.productos.push({ id, tipoId, nombre: productName });
  }
}
if (state.productos.length !== 100) throw new Error(`Se esperaban 100 productos; hay ${state.productos.length}.`);
validateState(state);
await writeFile(new URL("../docs/catalogo-inicial.json", import.meta.url), `${JSON.stringify(state, null, 2)}\n`, "utf8");
console.log(`Catálogo inicial generado: ${state.tipos.length} tipos y ${state.productos.length} productos.`);
