# Despensa

Aplicación personal de despensa para una vivienda. Están implementadas las **ubicaciones y el catálogo**. Puedes crear, renombrar y mover contenedores; crear tipos y productos; cambiar el tipo de un producto y consultar productos por tipo. Un producto puede existir sin unidades almacenadas. Se bloquea el borrado de tipos con productos y de productos con existencias. Al eliminar una estancia, una confirmación indica cuántos contenedores vacíos se borrarán con ella; si contienen existencias, el borrado se bloquea. La interfaz se adapta a móvil, tableta y ordenador. El inventario de cantidades es la siguiente fase.

## Abrirla en local

Requiere Node.js. Desde esta carpeta:

```sh
node tools/serve.js
```

Abre `http://127.0.0.1:4173/`. No conviene abrir `docs/index.html` como archivo: IndexedDB, el Service Worker y la comprobación de conexión necesitan un origen HTTP o HTTPS.

Para ejecutar las pruebas de reglas de datos:

```sh
node --test
```

## Datos y copias

Los cambios se guardan automáticamente en IndexedDB de **cada navegador y dispositivo**. La web no tiene servidor de datos ni sincronización. Usa **Exportar JSON** para descargar una copia restaurable y **Importar JSON** para transferirla a otro dispositivo. La importación valida el archivo y muestra una vista previa antes de reemplazar todos los datos locales. **Descargar CSV** genera una tabla legible de ubicaciones.

La consulta de datos guardados funciona sin conexión después de cargar la aplicación al menos una vez; las modificaciones y la importación requieren conexión con el sitio. El navegador puede borrar su almacenamiento local, así que conserva los JSON fuera de él. No subas tus exportaciones reales al repositorio público.

## Catálogo inicial

El archivo [catalogo-inicial.json](docs/catalogo-inicial.json) forma parte de la web y contiene **100 productos en 11 tipos**, sin estancias, contenedores ni existencias. La aplicación incorpora ese catálogo automáticamente al primer uso. Si ya hay ubicaciones guardadas y el catálogo está vacío, añade los productos sin borrar las ubicaciones. Si ya existe un catálogo propio, lo conserva. Después puedes añadir, renombrar o eliminar productos y tipos; el catálogo inicial no reaparece si vacías el tuyo.

**Importar JSON** sigue sirviendo para restaurar o trasladar copias entre dispositivos y sustituye todos los datos locales tras confirmación. Para regenerar el archivo inicial tras editar su lista, ejecuta `node tools/generate-starter.js`.

## Publicar con GitHub Pages

Los archivos publicables están en `docs/`. En la configuración del repositorio, elige **Deploy from a branch**, la rama que uses y la carpeta **`/docs`**. El repositorio de GitHub Pages personal gratuito puede ser público: confirma que solo subes código y datos ficticios. La publicación aún no se ha realizado.

La definición, decisiones y fases están en [fase_0_analisis.md](fase_0_analisis.md). Las comprobaciones están en [fase_1_verificacion.md](fase_1_verificacion.md) y [fase_2_verificacion.md](fase_2_verificacion.md).
