import {
  addShoppingItem,
  addStock,
  canonicalName,
  cleanName,
  completeShoppingItem,
  consumeStock,
  createContenedor,
  createEstancia,
  createProducto,
  createTipo,
  deleteContenedor,
  deleteEstancia,
  deleteProducto,
  deleteTipo,
  moveContenedor,
  moveStock,
  parseImportJson,
  renameContenedor,
  renameEstancia,
  renameTipo,
  removeShoppingItem,
  updateProducto,
  applyMinimumRestock,
} from "./domain.js";
import { AuthenticationError, checkServer, commitState, hasPassword, listBackups, listHistory, loadBackup, loadState, RevisionConflictError, setPassword } from "./storage.js";

const $ = (id) => document.getElementById(id);
const ui = {
  loginDialog: $("login-dialog"),
  loginForm: $("login-form"),
  loginPassword: $("login-password"),
  loginError: $("login-error"),
  loginSubmit: $("login-submit"),
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
  editMinimum: $("edit-minimum"),
  minimumField: $("minimum-field"),
  editKicker: $("edit-kicker"),
  editError: $("edit-error"),
  editSimilar: $("edit-similar"),
  editSubmit: $("edit-submit"),
  importDialog: $("import-dialog"),
  importSummary: $("import-summary"),
  importFile: $("import-file"),
  importConfirm: $("import-confirm"),
  lastExport: $("last-export"),
  autoBackupStatus: $("auto-backup-status"),
  downloadAutoBackup: $("download-auto-backup"),
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
  bulkMinimums: $("bulk-minimums"),
  bulkMinimumDialog: $("bulk-minimum-dialog"),
  bulkMinimumForm: $("bulk-minimum-form"),
  bulkMinimumList: $("bulk-minimum-list"),
  bulkMinimumError: $("bulk-minimum-error"),
  bulkMinimumSubmit: $("bulk-minimum-submit"),
  catalogOfflineHint: $("catalog-offline-hint"),
  shoppingOfflineHint: $("shopping-offline-hint"),
  inventoryOfflineHint: $("inventory-offline-hint"),
  addStock: $("add-stock"),
  stockTotal: $("stock-total"),
  stockProducts: $("stock-products"),
  shoppingTotal: $("shopping-total"),
  stockList: $("stock-list"),
  lowStockPanel: $("low-stock-panel"),
  lowStockList: $("low-stock-list"),
  goShoppingFromLow: $("go-shopping-from-low"),
  historyPanel: $("history-panel"),
  historyList: $("history-list"),
  shoppingList: $("shopping-list"),
  shoppingForm: $("shopping-form"),
  shoppingName: $("shopping-name"),
  shoppingSuggestions: $("shopping-suggestions"),
  shoppingNewFields: $("shopping-new-fields"),
  shoppingType: $("shopping-type"),
  shoppingNewTypeField: $("shopping-new-type-field"),
  shoppingNewType: $("shopping-new-type"),
  shoppingQuantity: $("shopping-quantity"),
  shoppingError: $("shopping-error"),
  shoppingSubmit: $("shopping-submit"),
  stockDialog: $("stock-dialog"),
  stockForm: $("stock-form"),
  stockDialogTitle: $("stock-dialog-title"),
  stockHelp: $("stock-help"),
  stockProductField: $("stock-product-field"),
  stockProduct: $("stock-product"),
  stockTargetField: $("stock-target-field"),
  stockTargetLabel: $("stock-target-label"),
  stockTarget: $("stock-target"),
  stockQuantity: $("stock-quantity"),
  stockQuantityLabel: $("stock-quantity-label"),
  stockRestockField: $("stock-restock-field"),
  stockRestock: $("stock-restock"),
  stockRestockQuantityField: $("stock-restock-quantity-field"),
  stockRestockQuantity: $("stock-restock-quantity"),
  stockError: $("stock-error"),
  stockSubmit: $("stock-submit"),
};

let state;
let selectedRoomId = null;
let selectedTypeId = null;
let connected = false;
let editMode = null;
let pendingImport = null;
let importBusy = false;
let lastExportAt = null;
let toastTimeout;
let stockMode = null;

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
    const minimum = document.createElement("span");
    minimum.className = "product-type";
    minimum.textContent = product.stockMinimo > 0 ? `Mínimo: ${product.stockMinimo}` : "Sin stock mínimo";
    const actions = document.createElement("div");
    actions.className = "container-actions";
    actions.append(
      makeButton("Editar", "text-button", () => openEditor("product-edit", product.id), !connected),
      makeButton("Eliminar", "text-button text-button-danger", () => removeProduct(product.id), !connected),
    );
    card.append(name, type, minimum, actions);
    ui.productList.append(card);
  }
}

function renderCatalog() {
  ui.typeCount.textContent = String(state.tipos.length);
  ui.productCount.textContent = String(state.productos.length);
  ui.addType.disabled = !connected;
  ui.addProduct.disabled = !connected || state.tipos.length === 0;
  ui.bulkMinimums.disabled = !connected || state.productos.length === 0;
  renderTypes();
  renderProducts();
}

function productName(id) {
  return state.productos.find((entry) => entry.id === id)?.nombre ?? "Producto desconocido";
}

function containerLabel(id) {
  if (id === null) return "Sin asignar";
  const container = state.contenedores.find((entry) => entry.id === id);
  const room = state.estancias.find((entry) => entry.id === container?.estanciaId);
  return `${room?.nombre ?? "Estancia"} · ${container?.nombre ?? "Contenedor"}`;
}

function normalizedSearch(value) {
  return value.trim().replace(/\s+/gu, " ").normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
}

function matchingProduct() {
  const name = ui.shoppingName.value.trim();
  if (!name) return null;
  return state.productos.find((entry) => normalizedSearch(entry.nombre) === normalizedSearch(name)) ?? null;
}

function populateShoppingTypes() {
  const selected = ui.shoppingType.value;
  ui.shoppingType.replaceChildren();
  for (const type of [...state.tipos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))) {
    ui.shoppingType.add(new Option(type.nombre, type.id));
  }
  ui.shoppingType.add(new Option("+ Crear categoría nueva", "new"));
  ui.shoppingType.value = [...ui.shoppingType.options].some((option) => option.value === selected) ? selected : state.tipos[0]?.id ?? "new";
  ui.shoppingNewTypeField.hidden = ui.shoppingType.value !== "new";
}

function updateShoppingSuggestions() {
  const query = normalizedSearch(ui.shoppingName.value);
  const matches = query ? state.productos.filter((entry) => normalizedSearch(entry.nombre).includes(query)).slice(0, 6) : [];
  ui.shoppingSuggestions.replaceChildren();
  for (const product of matches) {
    const button = makeButton(product.nombre, "suggestion-item", () => {
      ui.shoppingName.value = product.nombre;
      updateShoppingSuggestions();
      ui.shoppingQuantity.focus();
    });
    button.setAttribute("role", "option");
    ui.shoppingSuggestions.append(button);
  }
  ui.shoppingSuggestions.hidden = matches.length === 0 || Boolean(matchingProduct());
  ui.shoppingNewFields.hidden = !query || Boolean(matchingProduct());
  ui.shoppingError.hidden = true;
}

function renderInventory() {
  ui.stockTotal.textContent = String(state.existencias.reduce((total, entry) => total + entry.cantidad, 0));
  ui.stockProducts.textContent = String(new Set(state.existencias.map((entry) => entry.productoId)).size);
  ui.shoppingTotal.textContent = String(state.compras.reduce((total, entry) => total + entry.cantidad, 0));
  ui.addStock.disabled = !connected || !state.productos.length;
  ui.shoppingSubmit.disabled = !connected;
  const lowStock = state.productos.map((product) => {
    const minimum = product.stockMinimo ?? 0;
    const current = state.existencias.filter((entry) => entry.productoId === product.id).reduce((sum, entry) => sum + entry.cantidad, 0);
    return { product, minimum, current, missing: minimum - current };
  }).filter((entry) => entry.minimum > 0 && entry.missing > 0).sort((a, b) => b.missing - a.missing || a.product.nombre.localeCompare(b.product.nombre, "es"));
  ui.lowStockPanel.hidden = lowStock.length === 0;
  ui.lowStockList.replaceChildren();
  for (const entry of lowStock) {
    const row = document.createElement("div");
    row.className = "stock-row";
    const details = document.createElement("div");
    details.className = "stock-details";
    const name = document.createElement("strong");
    name.textContent = entry.product.nombre;
    const count = document.createElement("span");
    count.textContent = `${entry.current} actuales · mínimo ${entry.minimum} · faltan ${entry.missing}`;
    details.append(name, count);
    const pending = state.compras.find((item) => item.productoId === entry.product.id);
    const action = makeButton(pending ? "En la lista" : "Añadir a la lista", "text-button", () => {
      if (pending) { document.querySelector('[data-view="compra"]').click(); return; }
      saveChange((current) => applyMinimumRestock(current, entry.product.id), "Producto añadido a la lista de la compra.").catch(showError);
    }, !connected || Boolean(pending));
    row.append(details, action);
    ui.lowStockList.append(row);
  }
  populateShoppingTypes();
  updateShoppingSuggestions();
  ui.stockList.replaceChildren();
  if (!state.existencias.length) {
    ui.stockList.append(makeEmptyState("▤", "Aún no hay existencias", "Añade unidades de un producto. Puedes asignarles un contenedor después."));
  } else {
    const containerIds = [null, ...[...state.contenedores].sort((a, b) => containerLabel(a.id).localeCompare(containerLabel(b.id), "es")).map((entry) => entry.id)];
    for (const containerId of containerIds) {
      const stocks = state.existencias.filter((entry) => entry.contenedorId === containerId).sort((a, b) => productName(a.productoId).localeCompare(productName(b.productoId), "es"));
      if (!stocks.length) continue;
      const group = document.createElement("section");
      group.className = "stock-group";
      const heading = document.createElement("h3");
      heading.textContent = containerLabel(containerId);
      group.append(heading);
      for (const stock of stocks) {
        const row = document.createElement("div");
        const product = state.productos.find((entry) => entry.id === stock.productoId);
        const minimum = product?.stockMinimo ?? 0;
        const productTotal = state.existencias.filter((entry) => entry.productoId === stock.productoId).reduce((sum, entry) => sum + entry.cantidad, 0);
        const isLow = minimum > 0 && productTotal < minimum;
        row.className = isLow ? "stock-row is-low-stock" : "stock-row";
        const details = document.createElement("div");
        details.className = "stock-details";
        const name = document.createElement("strong");
        name.textContent = productName(stock.productoId);
        const count = document.createElement("span");
        count.textContent = `${stock.cantidad} ${stock.cantidad === 1 ? "unidad" : "unidades"}`;
        if (isLow) {
          const badge = document.createElement("span");
          badge.className = "low-stock-badge";
          badge.textContent = `Bajo mínimo · ${productTotal}/${minimum}`;
          details.append(name, count, badge);
        } else {
          details.append(name, count);
        }
        const actions = document.createElement("div");
        actions.className = "stock-actions";
        actions.append(
          makeButton("+ Entrada", "text-button", () => openStockDialog("add", stock), !connected),
          makeButton("− Salida", "text-button", () => openStockDialog("remove", stock), !connected),
          makeButton("Mover", "text-button", () => openStockDialog("move", stock), !connected || (stock.contenedorId === null ? state.contenedores.length === 0 : false)),
        );
        row.append(details, actions);
        group.append(row);
      }
      ui.stockList.append(group);
    }
  }
  ui.shoppingList.replaceChildren();
  if (!state.compras.length) {
    ui.shoppingList.append(makeEmptyState("☑", "Lista vacía", "Busca un producto del catálogo o crea uno nuevo aquí."));
  } else {
    for (const item of [...state.compras].sort((a, b) => productName(a.productoId).localeCompare(productName(b.productoId), "es"))) {
      const row = document.createElement("div");
      row.className = "shopping-row";
      const details = document.createElement("div");
      details.className = "stock-details";
      const name = document.createElement("strong");
      name.textContent = productName(item.productoId);
      const count = document.createElement("span");
      count.textContent = `${item.cantidad} ${item.cantidad === 1 ? "unidad" : "unidades"} pendiente${item.cantidad === 1 ? "" : "s"}`;
      details.append(name, count);
      const actions = document.createElement("div");
      actions.className = "stock-actions";
      actions.append(
        makeButton("Guardar compra", "text-button", () => openStockDialog("purchase", item), !connected),
        makeButton("Quitar", "text-button text-button-danger", () => discardShoppingItem(item.id), !connected),
      );
      row.append(details, actions);
      ui.shoppingList.append(row);
    }
  }
}

function renderLastExport() {
  const value = lastExportAt;
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
  renderInventory();
  renderLastExport();
}

function setConnection(value) {
  connected = value;
  ui.connection.classList.toggle("is-offline", !value);
  ui.connection.classList.remove("is-checking");
  ui.connectionText.textContent = value ? "Con conexión" : "Sin conexión";
  ui.offlineHint.hidden = value;
  ui.catalogOfflineHint.hidden = value;
  ui.shoppingOfflineHint.hidden = value;
  ui.inventoryOfflineHint.hidden = value;
  render();
}

function showLogin() {
  setConnection(false);
  ui.connectionText.textContent = "Contraseña necesaria";
  if (!ui.loginDialog.open) ui.loginDialog.showModal();
}

async function submitLogin(event) {
  event.preventDefault();
  ui.loginError.hidden = true;
  ui.loginSubmit.disabled = true;
  setPassword(ui.loginPassword.value);
  try {
    state = await loadState();
    await refreshAutoBackupStatus();
    await refreshHistory();
    ui.loginPassword.value = "";
    ui.loginDialog.close();
    render();
    await checkConnection();
  } catch (error) {
    setPassword(null);
    ui.loginError.textContent = error instanceof AuthenticationError
      ? "Contraseña incorrecta. Vuelve a intentarlo."
      : error instanceof TypeError && /fetch/i.test(error.message)
        ? "No se pudo conectar con el servidor. Comprueba tu conexión a Internet y vuelve a intentarlo."
      : error.message;
    ui.loginError.hidden = false;
  } finally {
    ui.loginSubmit.disabled = false;
  }
}

async function refreshAutoBackupStatus() {
  try {
    const result = await listBackups();
    const latest = result.backups?.[0];
    ui.autoBackupStatus.textContent = latest
      ? `Copia automática más reciente: ${new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${latest.date}T00:00:00Z`))}. Se conservan hasta 30 días.`
      : "La primera copia automática se creará al consultar los datos.";
    ui.downloadAutoBackup.disabled = !latest;
    ui.downloadAutoBackup.dataset.date = latest?.date ?? "";
  } catch {
    ui.autoBackupStatus.textContent = "No se pudo consultar el estado de las copias automáticas.";
    ui.downloadAutoBackup.disabled = true;
  }
}

async function downloadAutoBackup() {
  const date = ui.downloadAutoBackup.dataset.date;
  if (!date) return;
  try {
    const backup = await loadBackup(date);
    downloadFile(JSON.stringify({ ...backup, exportedAt: new Date().toISOString() }, null, 2), `despensa-automatica-${date}.json`, "application/json");
    showToast("Copia automática descargada.");
  } catch (error) {
    showError(error);
  }
}

async function refreshHistory() {
  try {
    const result = await listHistory();
    ui.historyList.replaceChildren();
    const entries = result.history ?? [];
    ui.historyPanel.hidden = entries.length === 0;
    for (const entry of entries.slice(0, 20)) {
      const row = document.createElement("div");
      row.className = "history-row";
      const date = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.at));
      const summary = entry.details?.join(" · ") ?? entry.changed.join(", ");
      row.textContent = `${date} · revisión ${entry.revision} · ${summary}`;
      ui.historyList.append(row);
    }
  } catch {
    ui.historyPanel.hidden = true;
  }
}

async function checkConnection() {
  try {
    setConnection(await checkServer());
  } catch (error) {
    if (error instanceof AuthenticationError) {
      setPassword(null);
      showLogin();
    } else {
      setConnection(false);
    }
  }
  return connected;
}

async function requireConnection() {
  if (!(await checkConnection())) {
    throw new Error("Necesitas conexión con el servidor para consultar y guardar los datos.");
  }
}

async function refreshState() {
  if (!hasPassword()) return;
  if (!(await checkConnection())) return;
  try {
    const latest = await loadState();
    if (!state || latest.revision > state.revision) {
      state = latest;
      render();
    }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      setPassword(null);
      showLogin();
    } else {
      setConnection(false);
    }
  }
}

async function saveChange(transform, success) {
  await requireConnection();
  try {
    state = await commitState(state.revision, transform);
    render();
    refreshHistory();
    showToast(success);
  } catch (error) {
    if (error instanceof RevisionConflictError) {
      state = await loadState();
      render();
    }
    throw error;
  }
}

function fillSelect(select, entries, selectedId) {
  select.replaceChildren();
  for (const entry of entries) select.add(new Option(entry.label, entry.id));
  if (selectedId && entries.some((entry) => entry.id === selectedId)) select.value = selectedId;
}

function updateRestockOffer() {
  if (stockMode?.mode !== "remove") {
    ui.stockRestockField.hidden = true;
    return;
  }
  const { item } = stockMode;
  const quantity = Number(ui.stockQuantity.value);
  const productTotal = state.existencias.filter((entry) => entry.productoId === item.productoId).reduce((total, entry) => total + entry.cantidad, 0);
  const willDeplete = Number.isSafeInteger(quantity) && quantity > 0 && quantity === productTotal && quantity <= item.cantidad;
  ui.stockRestockField.hidden = !willDeplete;
  if (!willDeplete) ui.stockRestock.checked = false;
  ui.stockRestockQuantityField.hidden = !willDeplete || !ui.stockRestock.checked;
}

function openStockDialog(mode, item = null) {
  if (!connected) return;
  stockMode = { mode, item };
  ui.stockError.hidden = true;
  ui.stockProductField.hidden = mode !== "add";
  ui.stockHelp.hidden = mode !== "purchase";
  ui.stockTargetField.hidden = mode === "remove" || mode === "purchase";
  ui.stockDialogTitle.textContent = mode === "move" ? `Mover unidades desde ${containerLabel(item.contenedorId)}` : { add: "Añadir existencias", remove: "Retirar unidades", purchase: "Guardar compra" }[mode];
  ui.stockTargetLabel.textContent = mode === "move" ? "Destino" : "Ubicación";
  ui.stockQuantityLabel.textContent = mode === "purchase" ? "Unidades compradas" : "Unidades";
  ui.stockSubmit.textContent = mode === "remove" ? "Retirar" : mode === "move" ? "Mover" : "Guardar";
  fillSelect(ui.stockProduct, [...state.productos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((entry) => ({ id: entry.id, label: entry.nombre })), item?.productoId);
  const destinations = [
    { id: "", label: "Sin asignar (organizar después)" },
    ...[...state.contenedores].sort((a, b) => containerLabel(a.id).localeCompare(containerLabel(b.id), "es")).map((entry) => ({ id: entry.id, label: containerLabel(entry.id) })),
  ];
  fillSelect(ui.stockTarget, mode === "move" ? destinations.filter((entry) => (entry.id || null) !== item.contenedorId) : destinations, mode === "add" ? item?.contenedorId : null);
  ui.stockQuantity.value = String(mode === "purchase" ? item.cantidad : 1);
  ui.stockRestock.checked = false;
  ui.stockRestockQuantity.value = "1";
  updateRestockOffer();
  ui.stockDialog.showModal();
  (mode === "add" ? ui.stockProduct : ui.stockQuantity).focus();
}

async function submitStock(event) {
  event.preventDefault();
  if (!stockMode) return;
  ui.stockError.hidden = true;
  ui.stockSubmit.disabled = true;
  const { mode, item } = stockMode;
  const cantidad = Number(ui.stockQuantity.value);
  const productoId = mode === "add" ? ui.stockProduct.value : item.productoId;
  const contenedorId = mode === "add" ? ui.stockTarget.value || null : item.contenedorId;
  const targetId = ui.stockTarget.value || null;
  const newId = crypto.randomUUID();
  const shoppingId = crypto.randomUUID();
  const shoppingQuantity = mode === "remove" && ui.stockRestock.checked && !ui.stockRestockField.hidden
    ? Number(ui.stockRestockQuantity.value) : null;
  try {
    if (mode === "add") {
      await saveChange((current) => addStock(current, { id: newId, productoId, contenedorId, cantidad }), "Existencias añadidas.");
    } else if (mode === "remove") {
      await saveChange((current) => applyMinimumRestock(consumeStock(current, { productoId, contenedorId, cantidad, shoppingId, shoppingQuantity }), productoId, shoppingId), shoppingQuantity === null ? "Unidades retiradas." : "Unidades retiradas y producto añadido a la lista de la compra.");
    } else if (mode === "move") {
      await saveChange((current) => moveStock(current, { id: newId, productoId, fromContainerId: contenedorId, toContainerId: targetId, cantidad }), "Unidades trasladadas.");
    } else if (mode === "purchase") {
      await saveChange((current) => completeShoppingItem(current, { itemId: item.id, cantidad, stockId: newId }), "Compra guardada sin asignar en el inventario.");
    }
    ui.stockDialog.close();
    stockMode = null;
  } catch (error) {
    showError(error, ui.stockError);
  } finally {
    ui.stockSubmit.disabled = false;
  }
}

async function submitShopping(event) {
  event.preventDefault();
  ui.shoppingError.hidden = true;
  ui.shoppingSubmit.disabled = true;
  try {
    const name = cleanName(ui.shoppingName.value);
    const cantidad = Number(ui.shoppingQuantity.value);
    const matching = matchingProduct();
    const typeChoice = ui.shoppingType.value;
    const newTypeName = ui.shoppingNewType.value;
    const typeId = crypto.randomUUID();
    const productId = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    await saveChange((current) => {
      let next = current;
      let existing = current.productos.find((entry) => normalizedSearch(entry.nombre) === normalizedSearch(name));
      if (!existing) {
        const assignedTypeId = typeChoice === "new" ? typeId : typeChoice;
        if (typeChoice === "new") next = createTipo(next, { id: typeId, nombre: newTypeName });
        next = createProducto(next, { id: productId, tipoId: assignedTypeId, nombre: name });
        existing = next.productos.find((entry) => entry.id === productId);
      }
      return addShoppingItem(next, { id: itemId, productoId: existing.id, cantidad });
    }, matching ? "Producto añadido a la lista." : "Producto creado y añadido a la lista.");
    ui.shoppingName.value = "";
    ui.shoppingQuantity.value = "1";
    ui.shoppingNewType.value = "";
    updateShoppingSuggestions();
  } catch (error) {
    showError(error, ui.shoppingError);
  } finally {
    ui.shoppingSubmit.disabled = !connected;
  }
}

async function discardShoppingItem(id) {
  const item = state.compras.find((entry) => entry.id === id);
  if (!item || !window.confirm(`¿Quitar «${productName(item.productoId)}» de la lista de la compra?`)) return;
  try {
    await saveChange((current) => removeShoppingItem(current, id), "Producto quitado de la lista.");
  } catch (error) {
    showError(error);
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
  ui.minimumField.hidden = !["product-create", "product-edit"].includes(mode);
  ui.editMinimum.value = "0";
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
    ui.editMinimum.value = String(product?.stockMinimo ?? 0);
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

function openBulkMinimums() {
  if (!connected || !state.productos.length) return;
  ui.bulkMinimumError.hidden = true;
  ui.bulkMinimumList.replaceChildren();
  for (const product of [...state.productos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))) {
    const row = document.createElement("label");
    row.className = "bulk-minimum-row";
    const name = document.createElement("span");
    name.textContent = product.nombre;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.value = String(product.stockMinimo ?? 0);
    input.dataset.productId = product.id;
    row.append(name, input);
    ui.bulkMinimumList.append(row);
  }
  ui.bulkMinimumDialog.showModal();
}

async function submitBulkMinimums(event) {
  event.preventDefault();
  ui.bulkMinimumError.hidden = true;
  ui.bulkMinimumSubmit.disabled = true;
  try {
    const values = new Map([...ui.bulkMinimumList.querySelectorAll("input[data-product-id]")].map((input) => [input.dataset.productId, Number(input.value)]));
    if ([...values.values()].some((value) => !Number.isSafeInteger(value) || value < 0)) throw new Error("Todos los mínimos deben ser números enteros iguales o mayores que cero.");
    await saveChange((current) => ({ ...current, productos: current.productos.map((product) => ({ ...product, stockMinimo: values.get(product.id) })) }), "Stocks mínimos actualizados.");
    ui.bulkMinimumDialog.close();
  } catch (error) {
    showError(error, ui.bulkMinimumError);
  } finally {
    ui.bulkMinimumSubmit.disabled = false;
  }
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
  const stockMinimo = Number(ui.editMinimum.value);
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
      await saveChange((current) => createProducto(current, { id: newId, tipoId: typeId, nombre: name, stockMinimo }), "Producto creado.");
      selectedTypeId = typeId;
    } else if (mode === "product-edit") {
      await saveChange((current) => updateProducto(current, id, { tipoId: typeId, nombre: name, stockMinimo }), "Producto actualizado.");
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
  if (state.compras.some((entry) => entry.productoId === id)) {
    showToast("Retira el producto de la lista de la compra antes de borrarlo.", true);
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
  lastExportAt = new Date().toISOString();
  renderLastExport();
  showToast("Copia JSON descargada. Guárdala fuera del navegador.");
}

function csvValue(value) {
  const raw = String(value ?? "");
  const safe = /^[=+@\-\t\r]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

function exportCsv() {
  if (!state) return;
  const rows = [["Sección", "Estancia", "Contenedor", "Categoría", "Producto", "Unidades"]];
  for (const room of state.estancias) {
    const containers = state.contenedores.filter((entry) => entry.estanciaId === room.id);
    if (containers.length === 0) rows.push(["Ubicación", room.nombre, "", "", "", ""]);
    for (const container of containers) rows.push(["Ubicación", room.nombre, container.nombre, "", "", ""]);
  }
  for (const product of state.productos) {
    rows.push(["Catálogo", "", "", state.tipos.find((entry) => entry.id === product.tipoId)?.nombre ?? "", product.nombre, ""]);
  }
  for (const stock of state.existencias) {
    const container = state.contenedores.find((entry) => entry.id === stock.contenedorId);
    const room = state.estancias.find((entry) => entry.id === container?.estanciaId);
    const product = state.productos.find((entry) => entry.id === stock.productoId);
    rows.push(["Inventario", room?.nombre ?? "", stock.contenedorId === null ? "Sin asignar" : container?.nombre ?? "", state.tipos.find((entry) => entry.id === product?.tipoId)?.nombre ?? "", product?.nombre ?? "", stock.cantidad]);
  }
  for (const item of state.compras) {
    const product = state.productos.find((entry) => entry.id === item.productoId);
    rows.push(["Compra pendiente", "", "", state.tipos.find((entry) => entry.id === product?.tipoId)?.nombre ?? "", product?.nombre ?? "", item.cantidad]);
  }
  const csv = `\uFEFF${rows.map((row) => row.map(csvValue).join(",")).join("\r\n")}`;
  downloadFile(csv, `despensa-datos-${fileDate()}.csv`, "text/csv;charset=utf-8");
  showToast("CSV de datos descargado.");
}

async function prepareImport(file) {
  if (!file) return;
  if (file.size > 5_000_000) throw new Error("El archivo supera el tamaño máximo de 5 MB.");
  const parsed = parseImportJson(await file.text());
  pendingImport = parsed;
  ui.importSummary.textContent = `El archivo contiene ${parsed.estancias.length} estancias, ${parsed.contenedores.length} contenedores, ${parsed.tipos.length} tipos, ${parsed.productos.length} productos, ${parsed.existencias.length} existencias y ${parsed.compras.length} productos pendientes de compra.`;
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
      window.scrollTo(0, 0);
    });
  }
}

function setupEvents() {
  ui.loginForm.addEventListener("submit", submitLogin);
  ui.goShoppingFromLow.addEventListener("click", () => document.querySelector('[data-view="compra"]').click());
  ui.downloadAutoBackup.addEventListener("click", downloadAutoBackup);
  ui.loginDialog.addEventListener("cancel", (event) => event.preventDefault());
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
  ui.bulkMinimums.addEventListener("click", openBulkMinimums);
  ui.bulkMinimumForm.addEventListener("submit", submitBulkMinimums);
  $("bulk-minimum-close").addEventListener("click", () => ui.bulkMinimumDialog.close());
  $("bulk-minimum-cancel").addEventListener("click", () => ui.bulkMinimumDialog.close());
  ui.renameType.addEventListener("click", () => openEditor("type-rename", selectedTypeId));
  ui.deleteType.addEventListener("click", removeType);
  ui.addStock.addEventListener("click", () => openStockDialog("add"));
  ui.stockForm.addEventListener("submit", submitStock);
  ui.stockQuantity.addEventListener("input", updateRestockOffer);
  ui.stockRestock.addEventListener("change", updateRestockOffer);
  $("stock-close").addEventListener("click", () => ui.stockDialog.close());
  $("stock-cancel").addEventListener("click", () => ui.stockDialog.close());
  ui.shoppingForm.addEventListener("submit", submitShopping);
  ui.shoppingName.addEventListener("input", updateShoppingSuggestions);
  ui.shoppingType.addEventListener("change", () => { ui.shoppingNewTypeField.hidden = ui.shoppingType.value !== "new"; });
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
  window.addEventListener("online", refreshState);
  window.addEventListener("offline", () => setConnection(false));
  window.addEventListener("focus", refreshState);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshState();
  });
  setInterval(() => { if (!document.hidden) refreshState(); }, 45_000);
}

async function start() {
  setupEvents();
  showLogin();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }
}

start();
