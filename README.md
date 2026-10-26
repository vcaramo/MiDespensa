# MiDespensa

Despensa personal con ubicaciones, catálogo, inventario y lista de la compra. La aplicación abre en Inventario y permite incorporar compras sin asignarlas a un contenedor. Incluye un catálogo inicial de 100 productos.

## Datos compartidos

La rama `desarrollo` sirve la web y una API desde un mismo Cloudflare Worker. El documento completo se guarda como JSON en un Durable Object con almacenamiento SQLite. Todos los dispositivos con una sesión autorizada leen ese mismo documento. Cada escritura comprueba la revisión anterior; si otro dispositivo guardó primero, la app recarga los datos y pide repetir el cambio.

El inventario no se guarda en IndexedDB ni en localStorage. La interfaz puede quedar abierta al perder la conexión, pero tras recargar sin conexión no puede consultar el inventario. Los archivos de la interfaz pueden quedar en la caché del navegador; `/api/*` nunca se almacena en el Service Worker.

## Pruebas locales

Requiere Node.js. Ejecuta `npm install` y después `npm run serve`. La web queda en `http://127.0.0.1:4173/`. La contraseña solo para las pruebas locales es `despensa-prueba-local-2026`. La configuración `wrangler.dev.jsonc` solo admite `localhost` y `127.0.0.1`; esa contraseña no existe en el Worker de producción. Los datos de prueba de Wrangler quedan en `.wrangler/`, excluido de Git.

Para las reglas de datos: `npm test`.

## Publicar en Cloudflare

1. Ejecuta `npm install` y `npx wrangler login`. Después, `npm run deploy` publica el Worker `midespensa` con los archivos de `docs/` y el Durable Object.
2. En **Workers & Pages > midespensa > Settings > Variables and Secrets**, crea un secreto llamado `APP_PASSWORD`. Escribe una contraseña única de al menos 16 caracteres y guárdala. No la incluyas en Git ni la envíes por chat.
3. Abre la URL de `workers.dev`, usa el identificador `admin` y esa contraseña, y verifica que aparece el inventario. El Worker crea la cuenta inicial del administrador al primer inicio de sesión. Si `APP_PASSWORD` no está configurada, la API de datos permanece cerrada.

El navegador conserva la sesión mediante una cookie segura. Durante la transición, la API también admite la contraseña compartida; se retirará cuando estén completas la gestión de usuarios y las pruebas de permisos. Los datos están asociados al Durable Object del Worker. Redeplegar el mismo Worker conserva el documento. No borres el Worker ni su almacenamiento sin una copia JSON exportada.

## Pasar los datos actuales

La aplicación publicada anteriormente en GitHub Pages usa IndexedDB en cada navegador. Abre esa versión en el dispositivo que tenga los datos más recientes y pulsa **Exportar JSON**. En la nueva URL de Cloudflare, pulsa **Importar JSON**, revisa el resumen y confirma. El archivo reemplaza el catálogo inicial y pasa a ser el documento compartido. La importación no fusiona inventarios.

El catálogo inicial está en [docs/catalogo-inicial.json](docs/catalogo-inicial.json). Para regenerarlo tras modificar su lista, ejecuta `node tools/generate-starter.js`.

La rama `main` continúa siendo el despliegue de GitHub Pages hasta que se apruebe la nueva versión. La documentación histórica se conserva en los archivos `fase_*.md`.
