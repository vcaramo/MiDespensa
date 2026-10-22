# Fase 2 — Catálogo: implementación y verificación

**Fecha:** 22 de octubre de 2026.  
**Estado:** implementado y probado; preparado para revisión del usuario.

## Implementado

- Alta, consulta, renombrado y eliminación protegida de tipos de producto.
- Alta, consulta, edición de nombre y tipo, y eliminación protegida de productos. Un producto puede existir sin existencias.
- Consulta de todos los productos o solo los de un tipo; los tipos se crean desde la interfaz.
- Rechazo de nombres duplicados de producto aunque cambien mayúsculas o espacios. Aviso no bloqueante si un nombre contiene otro ya registrado.
- Identificadores y relaciones conservados al renombrar y exportar. Los cambios se guardan en IndexedDB y la consulta funciona sin conexión.
- Diseño adaptable del catálogo a móvil, tableta y ordenador.

## Comprobaciones ejecutadas

| Escenario | Resultado |
| --- | --- |
| Crear Lácteos y Conservas, Leche entera y Atún en conserva sin existencias. | Pasa en pruebas de dominio y en una pestaña integrada de ensayo con origen `localhost`. |
| Renombrar un tipo y conservar la relación con sus productos. Editar un producto. | Pasa en pruebas de dominio y en navegador. |
| Ver todos los productos y filtrar por tipo. | Pasa en navegador. |
| Rechazar un nombre de producto duplicado; avisar de un nombre parecido sin bloquearlo. | Pasa en navegador. |
| Impedir borrar un tipo que tiene productos y un producto que tiene existencias. | Pasa en pruebas de dominio; el bloqueo de tipo pasa también en navegador. |
| Exportar el catálogo a JSON con IDs y relaciones. | Pasa: descarga real y contenido comprobado. La validación de importación del catálogo pasa en pruebas de dominio. |
| Cerrar y reabrir la aplicación. | Pasa: el catálogo permanece en IndexedDB. |
| Detener el servidor, recargar y consultar el catálogo sin conexión, con acciones de edición bloqueadas. | Pasa en la pestaña integrada de ensayo. |
| Revisar 320, 375, 768 y 1280 píxeles. | Pasa en la pestaña integrada: sin desbordamiento horizontal. No sustituye una prueba táctil en dispositivos físicos. |

La pestaña de ensayo usó `http://localhost:4174/`, que tiene almacenamiento separado del `http://127.0.0.1:4174/` abierto por el usuario. Los datos del usuario en esa pestaña no se modificaron.

## Próxima fase

La Fase 3 incorporará existencias en contenedores, entradas, salidas, traslados y totales por producto. La búsqueda por nombre y la consulta completa de ubicaciones están previstas para la Fase 4.
