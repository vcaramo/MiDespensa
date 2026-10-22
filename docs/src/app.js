import {
  createContenedor,
  createEstancia,
  createProducto,
  createTipo,
  deleteContenedor,
  deleteEstancia,
  deleteProducto,
  deleteTipo,
  moveContenedor,
  parseImportJson,
  renameContenedor,
  renameEstancia,
  renameTipo,
  updateProducto,
} from "./domain.js";
import { commitState, loadState, RevisionConflictError } from "./storage.js";

const $ = (id) => document.getElementById(id);
const ui = {
  connection: $("connection-status"),
  connectionText: document.querySelector("#connection-status .status-text"),
  offlineHint: $("offline-hint"),
  roomCount: $("room-count"),
  containerCount: $("container-count"),
  roomList: $("room-list"),
  containerList: $("container-list"),
  containersHeading: $("containers-heading"),
  roomActions: $("room-actions"),
  addRoomMain: $("add-room-main"),
  addRoomSmall: $("add-room-small"),
  addContainer: $("add-container"),
  renameRoom: $("rename-room"),
  deleteRoom: $("delete-room"),
  editDialog: $("edit-dialog"),
  editForm: $("edit-form"),
  editTitle: $("edit-title"),
  editName: $("edit-name"),
  editRoom: $("edit-room"),
  nameField: $("name-field"),
  roomField: $("room-field"),
  typeField: $("type-field"),
  editType: $("edit-type"),
  editKicker: $("edit-kicker"),
  editError: $("edit-error"),
  editSimilar: $("edit-similar"),
  editSubmit: $("edit-submit"),
  importDialog: $("import-dialog"),
  importSummary: $("import-summary"),
  importFile: $("import-file"),
  importConfirm: $("import-confirm"),
  lastExport: $("last-export"),
  toast: $("toast"),
  typeCount: $("type-count"),
  productCount: $("product-count"),
  typeList: $("type-list"),
  typeActions: $("type-actions"),
  renameType: $("rename-type"),
  deleteType: $("delete-type"),
  productsHeading: $("products-heading"),
  filteredProductCount: $("filtered-product-count"),
  productList: $("product-list"),
  addType: $("add-type"),
  addProduct: $("add-product"),
  catalogOfflineHint: $("catalog-offline-hint"),
};

let state;
let selectedRoomId = null;
let selectedTypeId = null;
let connected = false;
let editMode = null;
let pendingImport = null;
let importBusy = false;
let toastTimeout;

function showToast(message, isError = false) {
  clearTimeout(toastTimeout);
  ui.toast.textContent = message;
  ui.toast.classList.toggle("is-error", isError);
  ui.toast.hidden = false;
  toastTimeout = setTimeout(() => { ui.toast.hidden = true; }, 4800);
}

function showError(error, target = null) {
  const message = error instanceof Error ? error.message : "Ha ocurrido un error inesperado.";
  if (target) {
    target.textContent = message;
    target.hidden = false;
  } else {
    showToast(message, true);
  }
}

function makeButton(label, className, onClick, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function makeEmptyState(symbol, title, description) {
  const wrapper = document.createElement("div");
  wrapper.className = "empty-state";
  const icon = document.createElement("span");
  icon.className = "empty-state-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = symbol;
  const heading = document.createElement("h4");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = description;
  wrapper.append(icon, heading, paragraph);
  return wrapper;
}

function renderRooms() {
  ui.roomList.replaceChildren();
  if (state.estancias.length === 0) {
    ui.roomList.append(makeEmptyState("⌂", "Aún no hay estancias", "Crea tu primera estancia para organizar la vivienda."));
    return;
  }
  const rooms = [...state.estancias].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  for (const room of rooms) {
    const count = state.contenedores.filter((container) => container.estanciaId === room.id).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `room-item${room.id === selectedRoomId ? " is-selected" : ""}`;
    button.setAttribute("aria-pressed", String(room.id === selectedRoomId));
    button.addEventListener("click", () => {
      selectedRoomId = room.id;
      render();
    });
    const label = document.createElement("span");
    label.className = "room-item-name";
    const icon = document.createElement("span");
    icon.className = "room-item-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "⌂";
    const name = document.createElement("span");
    name.textContent = room.nombre;
    label.append(icon, name);
    const number = document.createElement("span");
    number.className = "room-item-count";
    number.textContent = String(count);
    number.setAttribute("aria-label", `${count} contenedores`);
    button.append(label, number);
    ui.roomList.append(button);
  }
}

function renderContainers() {
  ui.containerList.replaceChildren();
  const room = state.estancias.find((entry) => entry.id === selectedRoomId);
  ui.containersHeading.textContent = room?.nombre ?? "Elige una estancia";
  ui.roomActions.hidden = !room;
  ui.addContainer.disabled = !room || !connected;
  ui.renameRoom.disabled = !room || !connected;
  ui.deleteRoom.disabled = !room || !connected;
  if (!room) {
    ui.containerList.append(makeEmptyState("▦", "Selecciona una estancia", "Aquí verás todos sus espacios de almacenamiento."));
    return;
  }
  const containers = state.contenedores
    .filter((entry) => entry.estanciaId === room.id)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  if (containers.length === 0) {
    ui.containerList.append(makeEmptyState("▤", "Un espacio por llenar", "Añade una nevera, un armario, una estantería o cualquier otro contenedor."));
    return;
  }
  for (const container of containers) {
    const card = document.createElement("article");
    card.className = "container-card";
    const top = document.createElement("div");
    top.className = "container-card-top";
    const icon = document.createElement("span");
    icon.className = "container-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "▤";
    const titleGroup = document.createElement("div");
    const title = document.createElement("h4");
    title.className = "container-name";
    title.textContent = container.nombre;
    const subtitle = document.createElement("p");
    subtitle.className = "container-subtitle";
    subtitle.textContent = "Contenedor";
    titleGroup.append(title, subtitle);
    top.append(icon, titleGroup);
    const actions = document.createElement("div");
    actions.className = "container-actions";
    actions.append(
      makeButton("Renombrar", "text-button", () => openEditor("container-rename", container.id), !connected),
      makeButton("Mover", "text-button", () => openEditor("container-move", container.id), !connected),
      makeButton("Eliminar", "text-button text-button-danger", () => removeContainer(container.id), !connected),
    );
    card.append(top, actions);
    ui.containerList.append(card);
  }
}

function renderTypes() {
  ui.typeList.replaceChildren();
  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `type-item${selectedTypeId === null ? " is-selected" : ""}`;
  allButton.setAttribute("aria-pressed", String(selectedTypeId === null));
  allButton.append(document.createElement("span"), document.createElement("span"));
  allButton.firstChild.textContent = "Todos los productos";
  allButton.lastChild.textContent = String(state.productos.length);
  allButton.addEventListener("click", () => { selectedTypeId = null; renderCatalog(); });
  ui.typeList.append(allButton);
  for (const type of [...state.tipos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))) {
    const count = state.productos.filter((entry) => entry.tipoId === type.id).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `type-item${selectedTypeId === type.id ? " is-selected" : ""}`;
    button.setAttribute("aria-pressed", String(selectedTypeId === type.id));
    const label = document.createElement("span");
    label.textContent = type.nombre;
    const number = document.createElement("span");
    number.textContent = String(count);
    number.setAttribute("aria-label", `${count} ${count === 1 ? "producto" : "productos"}`);
    button.append(label, number);
    button.addEventListener("click", () => { selectedTypeId = type.id; renderCatalog(); });
    ui.typeList.append(button);
  }
  ui.typeActions.hidden = selectedTypeId === null;
  ui.renameType.disabled = !connected;
  ui.deleteType.disabled = !connected;
}

function renderProducts() {
  const selectedType = state.tipos.find((entry) => entry.id === selectedTypeId);
  ui.productsHeading.textContent = selectedType?.nombre ?? "Todos los productos";
  const products = state.productos
    .filter((entry) => !selectedType || entry.tipoId === selectedType.id)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  ui.filteredProductCount.textContent = `${products.length} ${products.length === 1 ? "producto" : "productos"}`;
  ui.productList.replaceChildren();
  if (!state.tipos.length) {
    ui.productList.append(makeEmptyState("◇", "Empieza por un tipo", "Crea un tipo de producto para organizar tu catálogo."));
    return;
  }
  if (!products.length) {
    ui.productList.append(makeEmptyState("◇", "Aún no hay productos", "Añade un producto a este catálogo. No necesita tener existencias."));
    return;
  }
  for (const product of products) {
    const card = document.createElement("article");
    card.className = "product-card";
    const name = document.createElement("h3");
    name.textContent = product.nombre;
    const type = document.createElement("span");
    type.className = "product-type";
    type.textContent = state.tipos.find((entry) => entry.id === product.tipoId)?.nombre ?? "Tipo desconocido";
    const actions = document.createElement("div");
    actions.className = "container-actions";
    actions.append(
      makeButton("Editar", "text-button", () => openEditor("product-edit", product.id), !connected),
      makeButton("Eliminar", "text-button text-button-danger", () => removeProduct(product.id), !connected),
    );
    card.append(name, type, actions);
    ui.productList.append(card);
  }
}

function renderCatalog() {
  ui.typeCount.textContent = String(state.tipos.length);
  ui.productCount.textContent = String(state.productos.length);
  ui.addType.disabled = !connected;
  ui.addProduct.disabled = !connected || state.tipos.length === 0;
  renderTypes();
  renderProducts();
}

function renderLastExport() {
  const value = localStorage.getItem("despensa-last-export");
  if (!value) {
    ui.lastExport.textContent = "Aún no has exportado una copia.";
    return;
  }
  const date = new Date(value);
  ui.lastExport.textContent = Number.isNaN(date.getTime())
    ? "Aún no has exportado una copia."
    : `Última copia JSON: ${new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(date)}.`;
}

function render() {
  if (!state) return;
  if (!state.estancias.some((entry) => entry.id === selectedRoomId)) {
    selectedRoomId = state.estancias[0]?.id ?? null;
  }
  if (!state.tipos.some((entry) => entry.id === selectedTypeId)) selectedTypeId = null;
  ui.roomCount.textContent = String(state.estancias.length);
  ui.containerCount.textContent = String(state.contenedores.length);
  ui.addRoomMain.disabled = !connected;
  ui.addRoomSmall.disabled = !connected;
  ui.importConfirm.disabled = !connected || importBusy;
  renderRooms();
  renderContainers();
  renderCatalog();
  renderLastExport();
}

function setConnection(value) {
  connected = value;
  ui.connection.classList.toggle("is-offline", !value);
  ui.connection.classList.remove("is-checking");
  ui.connectionText.textContent = value ? "Con conexión" : "Sin conexión";
  ui.offlineHint.hidden = value;
  ui.catalogOfflineHint.hidden = value;
  render();
}

async function checkConnection() {
  try {
    const url = new URL("./health.txt", location.href);
    url.searchParams.set("t", String(Date.now()));
    const response = await fetch(url, { cache: "no-store", redirect: "error" });
    const body = response.ok ? (await response.text()).trim() : "";
    setConnection(response.ok && body === "despensa-ok");
  } catch {
    setConnection(false);
  }
  return connected;
}

async function requireConnection() {
  if (!(await checkConnection())) {
    throw new Error("Necesitas conexión para guardar cambios. Los datos de este dispositivo siguen disponibles para consulta.");
  }
}

async function saveChange(transform, success) {
  await requireConnection();
  try {
    state = await commitState(state.revision, transform);
    render();
    showToast(success);
  } catch (error) {
    if (error instanceof RevisionConflictError) {
      state = await loadState();
      render();
    }
    throw error;
  }
}

function populateRoomSelect(selectedId) {
  ui.editRoom.replaceChildren();
  for (const room of [...state.estancias].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))) {
    const option = document.createElement("option");
    option.value = room.id;
    option.textContent = room.nombre;
    option.selected = room.id === selectedId;
    ui.editRoom.append(option);
  }
}

function populateTypeSelect(selectedId) {
  ui.editType.replaceChildren();
  for (const type of [...state.tipos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))) {
    const option = document.createElement("option");
    option.value = type.id;
    option.textContent = type.nombre;
    option.selected = type.id === selectedId;
    ui.editType.append(option);
  }
}

function updateSimilarHint() {
  ui.editSimilar.hidden = true;
  if (!editMode || !["product-create", "product-edit"].includes(editMode.mode)) return;
  const candidate = ui.editName.value.trim().replace(/\s+/gu, " ").normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
  if (candidate.length < 4) return;
  const similar = state.productos.find((entry) => {
    if (entry.id === editMode.id) return false;
    const existing = entry.nombre.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
    return existing !== candidate && (existing.includes(candidate) || candidate.includes(existing));
  });
  if (!similar) return;
  ui.editSimilar.textContent = `Ya existe «${similar.nombre}». Comprueba si se trata del mismo producto.`;
  ui.editSimilar.hidden = false;
}

function openEditor(mode, id = null) {
  if (!connected) return;
  editMode = { mode, id };
  ui.editError.hidden = true;
  ui.editSimilar.hidden = true;
  ui.editName.value = "";
  ui.nameField.hidden = mode === "container-move";
  ui.roomField.hidden = !["container-create", "container-move"].includes(mode);
  ui.typeField.hidden = !["product-create", "product-edit"].includes(mode);
  ui.editKicker.textContent = mode.startsWith("type-") || mode.startsWith("product-") ? "CATÁLOGO" : "UBICACIONES";
  const titles = {
    "room-create": "Nueva estancia",
    "room-rename": "Renombrar estancia",
    "container-create": "Nuevo contenedor",
    "container-rename": "Renombrar contenedor",
    "container-move": "Mover contenedor",
    "type-create": "Nuevo tipo",
    "type-rename": "Renombrar tipo",
    "product-create": "Nuevo producto",
    "product-edit": "Editar producto",
  };
  ui.editTitle.textContent = titles[mode];
  ui.editSubmit.textContent = mode === "container-move" ? "Mover" : "Guardar";
  if (mode === "room-rename") ui.editName.value = state.estancias.find((entry) => entry.id === id)?.nombre ?? "";
  if (mode === "container-rename") ui.editName.value = state.contenedores.find((entry) => entry.id === id)?.nombre ?? "";
  if (mode === "type-rename") ui.editName.value = state.tipos.find((entry) => entry.id === id)?.nombre ?? "";
  if (mode === "product-create") populateTypeSelect(selectedTypeId ?? state.tipos[0]?.id);
  if (mode === "product-edit") {
    const product = state.productos.find((entry) => entry.id === id);
    ui.editName.value = product?.nombre ?? "";
    populateTypeSelect(product?.tipoId);
  }
  if (mode === "container-create") populateRoomSelect(selectedRoomId);
  if (mode === "container-move") {
    const container = state.contenedores.find((entry) => entry.id === id);
    populateRoomSelect(container?.estanciaId);
  }
  ui.editDialog.showModal();
  updateSimilarHint();
  (mode === "container-move" ? ui.editRoom : ui.editName).focus();
}

async function submitEditor(event) {
  event.preventDefault();
  if (!editMode) return;
  ui.editError.hidden = true;
  ui.editSubmit.disabled = true;
  const { mode, id } = editMode;
  const name = ui.editName.value;
  const roomId = ui.editRoom.value;
  const typeId = ui.editType.value;
  try {
    if (mode === "room-create") {
      const newId = crypto.randomUUID();
      await saveChange((current) => createEstancia(current, { id: newId, nombre: name }), "Estancia creada.");
      selectedRoomId = newId;
    } else if (mode === "room-rename") {
      await saveChange((current) => renameEstancia(current, id, name), "Estancia renombrada.");
    } else if (mode === "container-create") {
      const newId = crypto.randomUUID();
      await saveChange((current) => createContenedor(current, { id: newId, estanciaId: roomId, nombre: name }), "Contenedor creado.");
      selectedRoomId = roomId;
    } else if (mode === "container-rename") {
      await saveChange((current) => renameContenedor(current, id, name), "Contenedor renombrado.");
    } else if (mode === "container-move") {
      await saveChange((current) => moveContenedor(current, id, roomId), "Contenedor movido.");
      selectedRoomId = roomId;
    } else if (mode === "type-create") {
      const newId = crypto.randomUUID();
      await saveChange((current) => createTipo(current, { id: newId, nombre: name }), "Tipo creado.");
      selectedTypeId = newId;
    } else if (mode === "type-rename") {
      await saveChange((current) => renameTipo(current, id, name), "Tipo renombrado.");
    } else if (mode === "product-create") {
      const newId = crypto.randomUUID();
      await saveChange((current) => createProducto(current, { id: newId, tipoId: typeId, nombre: name }), "Producto creado.");
      selectedTypeId = typeId;
    } else if (mode === "product-edit") {
      await saveChange((current) => updateProducto(current, id, { tipoId: typeId, nombre: name }), "Producto actualizado.");
      selectedTypeId = typeId;
    }
    ui.editDialog.close();
    editMode = null;
    render();
  } catch (error) {
    showError(error, ui.editError);
  } finally {
    ui.editSubmit.disabled = false;
  }
}

async function removeRoom() {
  const room = state.estancias.find((entry) => entry.id === selectedRoomId);
  if (!room) return;
  const containers = state.contenedores.filter((entry) => entry.estanciaId === room.id);
  const containerIds = new Set(containers.map((entry) => entry.id));
  if (state.existencias.some((entry) => containerIds.has(entry.contenedorId))) {
    showToast("Retira o traslada las existencias antes de borrar la estancia.", true);
    return;
  }
  const message = containers.length === 0
    ? `¿Eliminar la estancia «${room.nombre}»? Esta acción no se puede deshacer.`
    : `¿Eliminar la estancia «${room.nombre}» y sus ${containers.length} contenedores? Esta acción no se puede deshacer.`;
  if (!window.confirm(message)) return;
  try {
    await saveChange((current) => deleteEstancia(current, room.id), "Estancia y contenedores eliminados.");
  } catch (error) {
    showError(error);
  }
}

async function removeContainer(id) {
  const container = state.contenedores.find((entry) => entry.id === id);
  if (!container) return;
  if (state.existencias.some((entry) => entry.contenedorId === id)) {
    showToast("Retira o traslada sus existencias antes de borrar el contenedor.", true);
    return;
  }
  if (!window.confirm(`¿Eliminar el contenedor «${container.nombre}»?`)) return;
  try {
    await saveChange((current) => deleteContenedor(current, id), "Contenedor eliminado.");
  } catch (error) {
    showError(error);
  }
}

async function removeType() {
  const type = state.tipos.find((entry) => entry.id === selectedTypeId);
  if (!type) return;
  if (state.productos.some((entry) => entry.tipoId === type.id)) {
    showToast("Mueve o elimina sus productos antes de borrar el tipo.", true);
    return;
  }
  if (!window.confirm(`¿Eliminar el tipo «${type.nombre}»? Esta acción no se puede deshacer.`)) return;
  try {
    await saveChange((current) => deleteTipo(current, type.id), "Tipo eliminado.");
  } catch (error) {
    showError(error);
  }
}

async function removeProduct(id) {
  const product = state.productos.find((entry) => entry.id === id);
  if (!product) return;
  if (state.existencias.some((entry) => entry.productoId === id)) {
    showToast("Retira sus existencias antes de borrar el producto.", true);
    return;
  }
  if (!window.confirm(`¿Eliminar el producto «${product.nombre}»? Esta acción no se puede deshacer.`)) return;
  try {
    await saveChange((current) => deleteProducto(current, id), "Producto eliminado.");
  } catch (error) {
    showError(error);
  }
}

function fileDate() {
  return new Date().toISOString().slice(0, 10);
}

function downloadFile(contents, filename, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function exportJson() {
  if (!state) return;
  const document = { ...state, exportedAt: new Date().toISOString() };
  downloadFile(JSON.stringify(document, null, 2), `despensa-${fileDate()}.json`, "application/json");
  localStorage.setItem("despensa-last-export", new Date().toISOString());
  renderLastExport();
  showToast("Copia JSON descargada. Guárdala fuera del navegador.");
}

function csvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportCsv() {
  if (!state) return;
  const rows = [["Estancia", "Contenedor"]];
  for (const room of state.estancias) {
    const containers = state.contenedores.filter((entry) => entry.estanciaId === room.id);
    if (containers.length === 0) rows.push([room.nombre, ""]);
    for (const container of containers) rows.push([room.nombre, container.nombre]);
  }
  const csv = `\uFEFF${rows.map((row) => row.map(csvValue).join(",")).join("\r\n")}`;
  downloadFile(csv, `despensa-ubicaciones-${fileDate()}.csv`, "text/csv;charset=utf-8");
  showToast("CSV de ubicaciones descargado.");
}

async function prepareImport(file) {
  if (!file) return;
  if (file.size > 5_000_000) throw new Error("El archivo supera el tamaño máximo de 5 MB.");
  const parsed = parseImportJson(await file.text());
  pendingImport = parsed;
  ui.importSummary.textContent = `El archivo contiene ${parsed.estancias.length} estancias, ${parsed.contenedores.length} contenedores, ${parsed.tipos.length} tipos, ${parsed.productos.length} productos y ${parsed.existencias.length} existencias.`;
  ui.importDialog.showModal();
}

async function confirmImport() {
  if (!pendingImport || importBusy) return;
  importBusy = true;
  ui.importConfirm.disabled = true;
  try {
    await requireConnection();
    state = await commitState(state.revision, () => pendingImport);
    pendingImport = null;
    selectedRoomId = null;
    selectedTypeId = null;
    ui.importDialog.close();
    render();
    showToast("Datos reemplazados e importados correctamente.");
  } catch (error) {
    if (error instanceof RevisionConflictError) {
      state = await loadState();
      render();
    }
    showError(error);
  } finally {
    importBusy = false;
    ui.importConfirm.disabled = !connected;
  }
}

function setupNavigation() {
  for (const button of document.querySelectorAll("[data-view]")) {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      for (const item of document.querySelectorAll("[data-view]")) {
        const active = item === button;
        item.classList.toggle("is-active", active);
        if (active) item.setAttribute("aria-current", "page");
        else item.removeAttribute("aria-current");
      }
      for (const section of document.querySelectorAll(".view")) section.hidden = section.id !== `view-${view}`;
    });
  }
}

function setupEvents() {
  setupNavigation();
  ui.addRoomMain.addEventListener("click", () => openEditor("room-create"));
  ui.addRoomSmall.addEventListener("click", () => openEditor("room-create"));
  ui.addContainer.addEventListener("click", () => openEditor("container-create"));
  ui.renameRoom.addEventListener("click", () => openEditor("room-rename", selectedRoomId));
  ui.deleteRoom.addEventListener("click", removeRoom);
  ui.editForm.addEventListener("submit", submitEditor);
  ui.editName.addEventListener("input", () => {
    ui.editError.hidden = true;
    updateSimilarHint();
  });
  ui.addType.addEventListener("click", () => openEditor("type-create"));
  ui.addProduct.addEventListener("click", () => openEditor("product-create"));
  ui.renameType.addEventListener("click", () => openEditor("type-rename", selectedTypeId));
  ui.deleteType.addEventListener("click", removeType);
  $("edit-close").addEventListener("click", () => ui.editDialog.close());
  $("edit-cancel").addEventListener("click", () => ui.editDialog.close());
  $("export-json").addEventListener("click", exportJson);
  $("export-csv").addEventListener("click", exportCsv);
  $("import-json").addEventListener("click", () => ui.importFile.click());
  ui.importFile.addEventListener("change", async () => {
    try {
      await prepareImport(ui.importFile.files?.[0]);
    } catch (error) {
      showError(error);
    } finally {
      ui.importFile.value = "";
    }
  });
  $("import-close").addEventListener("click", () => ui.importDialog.close());
  $("import-cancel").addEventListener("click", () => ui.importDialog.close());
  $("import-backup").addEventListener("click", exportJson);
  ui.importConfirm.addEventListener("click", confirmImport);
  window.addEventListener("online", checkConnection);
  window.addEventListener("offline", () => setConnection(false));
  window.addEventListener("focus", checkConnection);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkConnection();
  });
  setInterval(() => { if (!document.hidden) checkConnection(); }, 45_000);
}

async function start() {
  setupEvents();
  try {
    state = await loadState();
    render();
    await checkConnection();
  } catch (error) {
    showError(error);
    ui.connectionText.textContent = "Datos no disponibles";
  }
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }
}

start();
