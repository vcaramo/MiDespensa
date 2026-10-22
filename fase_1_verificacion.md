# Fase 1 — Registro de implementación y verificación

**Fecha:** 22 de octubre de 2026.  
**Estado:** el usuario informó de una prueba satisfactoria de la primera entrega en navegador. La revisión de borrado en cascada y ajustes de tamaños de pantalla requiere nueva comprobación visual.

## Implementado

- Alta, consulta, cambio de nombre y eliminación protegida de estancias y contenedores. La eliminación de una estancia borra en cascada sus contenedores vacíos tras confirmación; se bloquea si hay existencias.
- Movimiento de contenedores entre estancias conservando su identificador y sus relaciones.
- Rechazo de nombres duplicados en su ámbito y de borrados con elementos asociados.
- Guardado automático en IndexedDB con control de revisión para evitar sobrescritura entre pestañas.
- Exportación JSON restaurable, CSV legible de ubicaciones e importación JSON con validación, vista previa y confirmación antes de sustituir datos.
- Interfaz adaptable a móvil, tableta y ordenador, archivos para consulta sin conexión y bloqueo de escritura cuando falla la comprobación de conexión.
- Carpeta `docs/` preparada para GitHub Pages; no se ha publicado.

## Comprobaciones ejecutadas

| Escenario | Resultado |
| --- | --- |
| Crear Cocina y Despensa; Nevera y Armario en Cocina; Estantería en Despensa. | Pasa en pruebas de dominio. |
| Renombrar y mover, conservando ID y relaciones. | Pasa en pruebas de dominio. |
| Impedir nombres duplicados. Borrar una estancia con sus contenedores vacíos y conservar otras estancias. Bloquear si hay existencias. | Pasa en pruebas de dominio. |
| Restaurar estructura mediante exportación e importación JSON. | Pasa en prueba de serialización y validación. |
| Rechazar JSON inválido, referencias rotas y cantidades negativas. | Pasa en pruebas de dominio. |
| Sintaxis de JavaScript y entrega HTTP de página y archivo de conexión. | Pasa con Node.js y servidor local. |
| Crear y editar mediante la interfaz, cerrar y reabrir conservando datos, consulta sin red. | El usuario informó que la primera entrega funciona en su navegador. No se detallaron todos los escenarios de esta fila. |
| Importación real sobre IndexedDB y exportación descargada. | Pendiente de prueba en navegador. |
| Confirmación y borrado en cascada; diseño en móvil y tableta. | Pendiente de nueva prueba visual; el navegador automatizado no está disponible en este entorno. |

## Revisión manual antes de aprobar la fase

1. Ejecutar `node tools/serve.js` y abrir la aplicación en un navegador.
2. Crear las estancias y contenedores del primer escenario. Renombrar y mover un contenedor.
3. Recargar la página y comprobar que se conservan.
4. Borrar Cocina. La confirmación debe indicar que también se borrarán Nevera y Armario; cancelarla y comprobar que todo sigue presente. Confirmarla y comprobar que Despensa y Estantería permanecen.
5. Exportar el JSON, borrar los datos de prueba desde la interfaz e importarlo. Comprobar la vista previa, confirmar y revisar la restauración.
6. Desconectar la red después de cargar la aplicación. Recargar: las ubicaciones deben verse y los cambios deben quedar bloqueados.
7. Revisar en un móvil estrecho, una tableta y un ordenador que navegación, acciones, tarjetas, copias y diálogos se ajustan sin desbordamiento horizontal.

Las Fases 2 a 4 permanecen pendientes de la revisión prevista en `prompt_inical.md`.
