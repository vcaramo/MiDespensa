# Fase 0 — Definición aprobada para la primera versión

**Fecha:** 22 de octubre de 2026.  
**Fuente:** `prompt_inical.md` y decisiones posteriores del usuario.  
**Estado:** alcance de la primera versión definido; se inicia la Fase 1 con la instrucción «continúa».

## 1. Alcance confirmado

La primera versión será una aplicación **personal** para **una vivienda**, publicada como sitio estático gratuito en GitHub Pages. Tendrá tres áreas: **Ubicaciones**, **Catálogo** e **Inventario**. Funcionará en Android, iPhone/iPad y ordenadores con las capacidades de los navegadores compatibles.

Los datos se guardarán automáticamente en el navegador del dispositivo. La aplicación ofrecerá exportación e importación manual de un archivo **JSON** restaurable y una exportación de datos legibles. El JSON real de la despensa no se incluirá en el repositorio ni en el sitio publicado. Los datos de distintos dispositivos son independientes hasta transferir manualmente un archivo. Al importar, se mostrará una vista previa y, tras confirmación, se **sustituirán todos los datos locales**; no habrá fusión automática.

La aplicación permitirá **consultar sin conexión**, sobre los datos ya guardados, y exigirá conexión para altas, cambios, borrados, entradas, salidas, traslados e importaciones. Estar conectado **no sincroniza** los dispositivos: cada edición sigue guardándose solo en el dispositivo actual. El límite anterior de siete días sin revalidación se refería a cuentas remotas y no se aplica a esta versión personal.

Se aplazan las cuentas individuales, los perfiles administrador/editor/lector, los cambios compartidos automáticamente, el servidor de datos y las copias automáticas diarias. Para la futura versión compartida quedan registradas las decisiones ya tomadas: editor solo modifica catálogo e inventario; administrador modifica ubicaciones y gestiona personas y copias; lector solo consulta; se quieren 30 copias diarias y siete días de consulta local sin revalidar una cuenta.

## 2. Estructuras y modelo de datos

**Almacenamiento:** Hogar único → Estancias → Contenedores → Existencias.  
**Catálogo:** Tipos de producto → Productos.  
**Enlace:** cada existencia referencia exactamente un producto y un contenedor; un producto puede estar en varios contenedores sin duplicarse en el catálogo.

| Entidad | Datos mínimos | Relación |
| --- | --- | --- |
| Estancia | ID estable, nombre | Contiene varios contenedores. |
| Contenedor | ID estable, ID de estancia, nombre | Pertenece a una estancia y contiene existencias. |
| Tipo de producto | ID estable, nombre | Clasifica varios productos. |
| Producto | ID estable, ID de tipo, nombre descriptivo | Pertenece a un tipo, aunque no tenga existencias. |
| Existencia | ID estable, ID de contenedor, ID de producto, cantidad | Una fila por pareja producto–contenedor. |

El documento JSON incluirá una **versión de esquema** y estas colecciones. Los identificadores se conservarán al renombrar, trasladar y exportar/importar. Las existencias totales se calcularán sumando las ubicaciones de un producto; no se guardará un total independiente.

### Reglas de integridad

- Nombres no vacíos. Para productos, impedir dos nombres iguales tras quitar espacios sobrantes e ignorar mayúsculas; advertir de nombres parecidos sin bloquearlos. Un nombre descriptivo distingue marca o formato por ahora.
- Cada producto pertenece a **un** tipo. Cantidades en **unidades enteras**; no se permiten saldos negativos. Una fila de existencia contiene una cantidad positiva y desaparece al llegar a cero, sin borrar el producto.
- Impedir borrar una estancia con contenedores, un contenedor con existencias, un tipo con productos o un producto con existencias. El usuario deberá mover o retirar primero lo asociado.
- Trasladar un contenedor conserva su ID y su contenido. Trasladar existencias resta del origen y suma en destino como una sola operación lógica, conservando el producto del catálogo y el total.
- Validar un JSON completo antes de importarlo: versión compatible, IDs únicos, referencias válidas, nombres y cantidades correctos. Si falla, conservar intactos los datos actuales. Antes de sustituirlos, ofrecer exportar una copia de lo existente.
- Proteger cambios simultáneos en dos pestañas para que una no sobrescriba silenciosamente a la otra.

## 3. Tecnología y persistencia

La primera versión usará **HTML, CSS y JavaScript modular**, sin framework ni servicios de pago; GitHub Pages publicará únicamente los archivos estáticos. [GitHub documenta que Pages no ejecuta código de servidor](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site). En GitHub Free, el repositorio del sitio será público; solo contendrá código y ejemplos ficticios.

El estado de trabajo se guardará como datos JSON en **IndexedDB** del navegador. Exportar descargará un archivo `.json`; importar lo leerá y reemplazará el estado local tras validación y confirmación. Esto permite guardado automático en Android, iPhone/iPad y ordenador sin exigir acceso directo de la web a un archivo del sistema. [IndexedDB admite transacciones](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB). La exportación legible se propone en CSV.

Un **Service Worker** conservará los archivos necesarios para abrir la interfaz y consultar los datos locales sin conexión. Las operaciones de escritura comprobarán acceso real a un archivo pequeño del sitio mediante una petición no cacheada; una indicación del navegador por sí sola no basta para confirmar la conexión. [MDN advierte de la fiabilidad limitada de `navigator.onLine`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine).

El almacenamiento del navegador puede borrarse o desalojarse; la aplicación mostrará la fecha de última exportación y recordará que el archivo JSON manual es la copia recuperable fuera del navegador. [MDN documenta los límites del almacenamiento local](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). Cambiar de navegador, perfil, dispositivo u origen del sitio no traslada automáticamente los datos.

## 4. MVP y navegación

**Ubicaciones:** lista de estancias → contenedores de una estancia → contenido del contenedor.  
**Catálogo:** tipos → productos, alta y edición.  
**Inventario:** búsqueda y detalle de producto, ubicaciones, total, entrada, salida y traslado.

El MVP abarca las fases 1 a 4: estructura física configurable, catálogo reutilizable, inventario en unidades, consultas y búsqueda, persistencia local, consulta offline y exportación/importación manual. La primera versión no necesita lotes ni caducidades.

Se aplazan subdivisiones de contenedores, subtipos, varios tipos por producto, lotes, fechas de caducidad, campos separados de marca/formato/unidad/peso/volumen, código de barras, fotografía y descripción. Las subdivisiones y subtipos añadirían jerarquías; los lotes cambiarían la regla de una fila por producto y contenedor; las unidades distintas requerirían compatibilidad o conversión antes de sumar. Se estudiarán de nuevo antes de implementarlos.

## 5. Fases y criterios de aceptación

| Fase | Entrega y verificación |
| --- | --- |
| 0. Definición | Alcance personal, modelo, reglas, tecnología gratuita y pruebas documentados. |
| 1. Organización física | Crear `Cocina` y `Despensa`; `Nevera` y `Armario` en Cocina, `Estantería` en Despensa. Renombrar estancias/contenedores y trasladar un contenedor conservando su ID y relaciones. Bloquear borrados con elementos asociados. Cerrar y reabrir: datos presentes. Exportar JSON, borrar datos de prueba e importarlo: estructura recuperada. Sin red se pueden consultar ubicaciones, pero no modificarlas. |
| 2. Catálogo | Crear `Lácteos` y `Conservas`, `Leche entera` y `Atún en conserva`; consultar productos por tipo. Renombrar un tipo y conservar sus productos. Crear un nuevo tipo desde la interfaz sin modificar código. Rechazar nombre de producto duplicado y permitir producto sin stock. Exportar/importar conserva IDs y relaciones. |
| 3. Inventario | Guardar 2 unidades de leche en Nevera y 6 en Armario con un único producto: total 8. Retirar 1: total 7. Trasladar 2 del Armario a Nevera: total 7. Rechazar saldos negativos y cambios incompletos. Cerrar/reabrir y exportar/importar conserva cantidades y relaciones. |
| 4. Consultas y búsqueda | Buscar por nombre, filtrar por tipo y consultar ubicaciones y total. Probar consulta offline de datos guardados y bloqueo de cambios en Android, iPhone/iPad y ordenador. Comprobar que otro dispositivo solo recibe datos tras importación manual y que la importación reemplaza tras confirmación. |
| 5. Funciones posteriores | Estudiar y aprobar por separado las ampliaciones aplazadas, incluidas cuentas, sincronización y copias automáticas. |

Antes de dar una fase por terminada se comprobarán sus criterios. No se declarará completada una función solo por mostrar su interfaz.

## 6. Registro de decisiones y estado

| Decisión | Estado |
| --- | --- |
| Una vivienda, primera versión personal y tres áreas de navegación. | Confirmada. |
| Sitio estático en GitHub Pages y tecnología sin coste. | Confirmada. |
| Guardado automático local; exportación/importación manual JSON; datos independientes por dispositivo. | Confirmada. |
| Importación que sustituye todo tras vista previa y confirmación. | Confirmada. |
| Consulta offline y escritura solo con conexión, sin sincronización. | Confirmada. |
| Un tipo y nombre descriptivo por producto; unidades enteras, sin lotes/caducidad ni saldo negativo. | Confirmada. |
| Bloquear borrados con referencias y duplicados exactos de nombre de producto. | Confirmada. |
| IndexedDB, Service Worker, JavaScript modular y CSV legible. | Propuesta técnica concreta para implementar las decisiones anteriores. |
| Cuentas, perfiles, datos compartidos y 30 copias automáticas diarias. | Aplazadas expresamente para una versión posterior. |

**Fase 0:** definición revisada para la primera versión. **Fase 1:** implementación local preparada para revisión; las comprobaciones ejecutadas y pendientes constan en `fase_1_verificacion.md`. La Fase 2 espera la revisión de la Fase 1.
