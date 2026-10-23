# MiDespensa

Despensa personal con ubicaciones, catálogo, inventario y lista de la compra. La aplicación abre en Inventario y permite incorporar compras sin asignarles un contenedor. Incluye un catálogo inicial de 100 productos.

## Datos compartidos

La versión de la rama `desarrollo` sirve la web y una API desde un mismo Cloudflare Worker. El documento completo se guarda como JSON en un único Durable Object con almacenamiento SQLite. Todos los dispositivos autorizados leen ese mismo documento. Cada escritura comprueba la revisión anterior: si otro dispositivo guardó primero, la app recarga los datos y pide repetir el cambio. Los JSON exportados siguen sirviendo como copia restaurable; importar uno sustituye los datos compartidos después de una vista previa y confirmación.

El inventario **no se guarda en IndexedDB ni en localStorage**. La interfaz puede seguir abierta al perder la conexión, pero su vista puede quedar desactualizada; tras recargar sin conexión no se puede consultar el inventario. Los archivos de la interfaz pueden quedar en la caché del navegador; `/api/*` nunca se almacena en el Service Worker.

## Pruebas locales

Requiere Node.js. Ejecuta `npm install` y después `npm run serve`. La web queda en `http://127.0.0.1:4173/`. La configuración `wrangler.dev.jsonc` usa un punto de entrada exclusivo para pruebas y solo admite `localhost` y `127.0.0.1`. El Worker de producción (`wrangler.jsonc`) siempre exige un token de Cloudflare Access válido para la API. Los datos de prueba de Wrangler quedan en `.wrangler/`, excluido de Git.

Para las reglas de datos: `npm test`.

## Publicar en Cloudflare

1. Crea o usa una cuenta Cloudflare con Workers y Zero Trust. El repositorio GitHub continúa guardando solo código y el catálogo inicial, nunca inventarios reales.
2. Desde el proyecto, ejecuta `npm install` y `npx wrangler login`. Después, `npm run deploy` crea el Worker `midespensa` con los archivos de `docs/` y el Durable Object. Si el nombre ya está ocupado en tu cuenta, cambia `name` en `wrangler.jsonc` antes del despliegue.
3. En **Workers & Pages > midespensa > Access**, protege **previews y producción** y permite únicamente las direcciones de correo que vayan a usar la aplicación. No elijas una política de dominio completo si no quieres dar acceso a todas las personas de ese dominio.
4. En **Zero Trust > Access controls > Applications**, abre la aplicación de Access creada y copia su **Application Audience (AUD) Tag**. Anota también el nombre de equipo de la URL `https://NOMBRE.cloudflareaccess.com`. Configura en las variables del Worker `ACCESS_AUD` con el AUD y `ACCESS_TEAM_DOMAIN` con ese nombre de equipo. También puedes usar `npx wrangler secret put ACCESS_AUD` y `npx wrangler secret put ACCESS_TEAM_DOMAIN`. Vuelve a desplegar si modificaste `wrangler.jsonc`.
5. Abre la URL `https://midespensa.<tu-subdominio>.workers.dev/` y verifica que solicita la identificación de Access y que aparece el catálogo inicial. Hasta configurar Access y ambas variables, la API responde 403 y no entrega el inventario.

Cloudflare Access protege toda la web. Además, el Worker verifica la firma, emisor y audiencia del token de Access en cada petición a la API. Los datos están asociados al Durable Object del Worker; redeplegar el mismo Worker conserva el documento. No borres el Worker ni su almacenamiento sin una copia JSON exportada.

## Pasar los datos actuales

La aplicación publicada anteriormente en GitHub Pages usa IndexedDB en cada navegador. Abre esa versión en el dispositivo que tenga tus datos más recientes y pulsa **Exportar JSON**. En la nueva URL de Cloudflare, pulsa **Importar JSON**, revisa el resumen y confirma. El archivo reemplaza el catálogo inicial y pasa a ser el documento compartido. Verifica el inventario desde un segundo dispositivo antes de borrar los datos antiguos del navegador. Si diferentes dispositivos tienen cambios propios, exporta cada uno antes de elegir qué copia importar; la importación no fusiona inventarios.

El catálogo inicial está en [docs/catalogo-inicial.json](docs/catalogo-inicial.json). Para regenerarlo tras modificar su lista, ejecuta `node tools/generate-starter.js`.

La rama `main` continúa siendo el despliegue de GitHub Pages hasta que se apruebe la nueva versión. La documentación histórica de decisiones y comprobaciones se conserva en los archivos `fase_*.md`.
