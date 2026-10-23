# Fase 3: inventario y lista de la compra

## Funciones implementadas

- Existencias por producto y contenedor, con entradas, salidas y traslados de unidades enteras.
- Salidas bloqueadas cuando exceden el saldo; una existencia se retira del JSON al llegar a cero.
- Lista de la compra con sugerencias del catálogo al escribir. Si el producto no existe, se crea en una categoría existente o en una nueva.
- Los productos añadidos de nuevo a la lista acumulan sus unidades pendientes.
- Al guardar una compra, entra en el inventario sin contenedor. Se permite registrar una parte y mantener el resto pendiente. Las unidades sin asignar se pueden mover después a un contenedor.
- Si se compran más unidades que las previstas, entra la cantidad real y el producto deja de figurar como pendiente.
- Al retirar las últimas unidades de un producto aparece la opción de añadirlo a la lista de la compra y elegir cuántas reponer. Si ya está en la lista, se acumulan las cantidades.
- El JSON local y las copias exportadas incluyen la lista de la compra. Los JSON anteriores, sin ese campo, siguen siendo importables.
- CSV legible con ubicaciones, catálogo, existencias y compras pendientes.

## Comprobaciones realizadas

- `node --test`: 12 pruebas correctas, incluidas operaciones de existencias, compras parciales, validación de referencias y compatibilidad de copias anteriores.
- En el navegador local: sugerencia de un producto del catálogo, alta de producto y categoría desde la lista, creación de contenedor, registro parcial de una compra y rechazo de una salida excesiva.
- Vista móvil a 320 px: sin desbordamiento horizontal; resumen y paneles en una columna legible.
- Recarga del navegador: los datos de prueba permanecieron en el almacenamiento local.
- En el navegador local: una compra se guardó en «Sin asignar» y después se movió al contenedor «Cocina · Nevera».
- En el navegador local: con 1 unidad pendiente de leche se registraron 4 compradas; el inventario mostró 4 unidades nuevas sin asignar y 0 pendientes.
- En el navegador local: al retirar la última unidad de salsa apareció la opción de añadirla a la compra; se solicitaron 3 unidades y la lista mostró 3 pendientes. Al retirar de un contenedor todas sus unidades de leche mientras quedaba leche en otro, la opción no apareció.
- La aplicación abre y vuelve a abrir tras recargar en Inventario. La lista de la compra aparece solo en la segunda pestaña. A 320 px ambas pestañas se ven y la página no tiene desbordamiento horizontal.

## Alcance de esta versión

Los datos siguen siendo personales y locales a cada navegador. Para llevarlos a otro dispositivo hay que exportar e importar el JSON manualmente. Sin conexión se pueden consultar los datos ya guardados, pero las ediciones esperan a recuperar la conexión.
