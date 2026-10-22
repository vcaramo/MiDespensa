# CONTEXTO Y ROL

Actúa como un equipo experto en desarrollo de software compuesto por:

- Arquitecto de software.
- Desarrollador full-stack.
- Diseñador UX/UI.
- Especialista en bases de datos.
- Ingeniero de pruebas y calidad.

Tu misión es ayudarme a diseñar y desarrollar una **aplicación de gestión doméstica de despensa e inventario de productos**, intuitiva, flexible, escalable y sencilla de utilizar.

El desarrollo será incremental, dividido en fases funcionales que deberán ser revisadas y aprobadas antes de continuar.

No presupongas requisitos que no haya definido expresamente. Cuando una decisión afecte significativamente al funcionamiento, la arquitectura o la experiencia de usuario, presenta las alternativas y solicita mi decisión.

# CONSULTA O TAREA

Quiero desarrollar una aplicación que permita organizar y controlar los productos almacenados en mi vivienda.

La aplicación debe gestionar dos estructuras relacionadas, pero conceptualmente independientes:

**A. Organización física del almacenamiento**

Hogar → Estancias → Contenedores → Existencias de productos.

**B. Organización del catálogo**

Tipos de producto → Productos.

El catálogo permitirá dar de alta y clasificar los productos. El sistema de inventario permitirá identificar dónde se almacenan y cuántas existencias hay de cada uno.

# ESPECIFICACIONES

## 1. Gestión de estancias

El usuario podrá crear y administrar diferentes estancias de su vivienda.

Ejemplos:
- Cocina.
- Despensa.
- Garaje.
- Trastero.

La aplicación deberá permitir:

- Crear nuevas estancias.
- Consultar las estancias existentes.
- Modificar sus nombres.
- Eliminar estancias, con protección frente a la pérdida accidental de información.
- Acceder a los contenedores de cada estancia.

Las estancias serán configurables por el usuario.

## 2. Gestión de contenedores

Dentro de cada estancia podrán crearse diferentes contenedores o espacios de almacenamiento.

Ejemplos:
- Nevera.
- Congelador.
- Armario.
- Cajón.
- Estantería.

La aplicación deberá permitir:

- Crear contenedores dentro de una estancia.
- Asignar nombres personalizados.
- Consultar los contenedores de cada estancia.
- Modificar sus nombres.
- Eliminar contenedores con las comprobaciones necesarias.
- Cambiar un contenedor de estancia sin perder la información asociada.
- Acceder al inventario de productos almacenados.

Debe estudiarse si conviene permitir subdivisiones adicionales, como baldas, compartimentos o cajones dentro de otros contenedores. No implementar esta funcionalidad hasta que se apruebe.

## 3. Gestión de tipos de producto

La aplicación contará con un sistema de clasificación de productos mediante **tipos de producto**.

Ejemplos orientativos:
- Lácteos.
- Carnes.
- Pescados.
- Verduras.
- Frutas.
- Conservas.
- Legumbres.
- Pastas y arroces.
- Bebidas.
- Congelados.
- Limpieza.
- Higiene.

Estos ejemplos no serán categorías obligatorias ni una clasificación cerrada.

El usuario deberá poder:

- Crear nuevos tipos de producto.
- Asignar un nombre a cada tipo.
- Consultar todos los tipos existentes.
- Editar sus nombres.
- Eliminar tipos, protegiendo los productos que tengan asociados.
- Consultar los productos pertenecientes a un tipo.
- Filtrar y buscar productos por tipo.

El sistema debe permitir incorporar nuevos tipos sin modificar el código de la aplicación.

Debe estudiarse si un producto podrá pertenecer a un único tipo o a varios y si conviene admitir subtipos. Estas decisiones requerirán aprobación.

## 4. Catálogo de productos

La aplicación permitirá **dar de alta productos independientemente de que existan unidades almacenadas**.

El catálogo será el registro maestro de los productos conocidos por la aplicación.

Cada producto tendrá, inicialmente, los siguientes datos funcionales:

- Identificador interno único.
- Nombre del producto.
- Tipo de producto al que pertenece, conforme al modelo de clasificación aprobado.

La aplicación deberá permitir:

- Crear nuevos productos.
- Asignarles un tipo de producto.
- Consultar todos los productos registrados.
- Editar productos existentes.
- Cambiar su clasificación.
- Buscar productos por nombre.
- Filtrar productos por tipo.
- Eliminar productos, protegiendo las referencias existentes en el inventario.
- Seleccionar productos del catálogo para incorporarlos a un contenedor.

Propón, para su aprobación, la incorporación de otros atributos:

- Marca.
- Formato o presentación.
- Unidad de medida.
- Peso o volumen por envase.
- Código de barras.
- Fotografía.
- Descripción.
- Otros atributos que puedan resultar útiles.

No consideres aprobados estos campos adicionales por aparecer en esta propuesta.

Debe establecerse un criterio para evitar duplicados accidentales en el catálogo y diferenciar productos que tengan nombres similares pero características distintas.

## 5. Gestión de existencias e inventario

El inventario debe utilizar los productos previamente registrados en el catálogo.

La aplicación deberá permitir:

- Seleccionar un producto del catálogo.
- Incorporarlo a un contenedor.
- Registrar la cantidad almacenada.
- Aumentar o reducir sus existencias.
- Consultar los productos almacenados en cada contenedor.
- Consultar las ubicaciones en las que se encuentra un producto.
- Conocer las existencias de un producto en cada ubicación.
- Consultar las existencias totales de un producto, cuando las unidades sean compatibles.
- Trasladar productos entre contenedores sin perder información.

**Principio fundamental:** el producto del catálogo y sus existencias físicas son entidades distintas.

Por ejemplo:

Producto del catálogo: Leche entera.

Tipo: Lácteos.

Existencias:
- Cocina → Nevera: 2 unidades.
- Cocina → Armario: 6 unidades.

Total: 8 unidades.

El usuario no debería tener que registrar nuevamente el producto en el catálogo para almacenarlo en otra ubicación.

Estudia cómo gestionar lotes y fechas de caducidad diferentes para un mismo producto, presentando la propuesta antes de implementarla.

## 6. Interfaz de usuario

La interfaz deberá ser clara, visual y adecuada para uso doméstico habitual.

Propón las siguientes áreas funcionales:

**Vista de ubicaciones**
- Acceso a estancias.
- Acceso a contenedores.
- Consulta del contenido de cada contenedor.

**Vista de catálogo**
- Consulta de tipos de producto.
- Consulta de productos de cada tipo.
- Alta y edición de productos.

**Vista de inventario**
- Consulta de existencias.
- Búsqueda de productos.
- Identificación de ubicaciones.
- Operaciones de entrada, salida y traslado.

La organización definitiva de las pantallas quedará pendiente de aprobación.

La plataforma de ejecución (web, móvil, escritorio o combinación) también está pendiente de decidir.

## 7. Arquitectura y persistencia

Antes de programar:

- Analiza las posibles arquitecturas.
- Propón una solución tecnológica proporcionada al proyecto.
- Define el modelo de datos y sus relaciones.
- Diferencia correctamente catálogo, clasificación, ubicaciones e inventario.
- Estudia cómo almacenar la información de forma persistente.
- Considera las necesidades de copia de seguridad y recuperación.
- Separa correctamente interfaz, lógica de negocio y almacenamiento.

Como mínimo, el análisis del modelo de datos deberá contemplar:

- Estancia.
- Contenedor.
- Tipo de producto.
- Producto.
- Existencia o registro de inventario.

Define las relaciones entre estas entidades y las restricciones necesarias para asegurar la integridad de la información.

No selecciones automáticamente un framework, base de datos o plataforma sin justificarlo y obtener mi aprobación.

## 8. Desarrollo por fases

Organiza el trabajo inicialmente en:

**Fase 0 — Análisis y definición**

Recopilación de requisitos, decisiones técnicas, diseño funcional y definición del MVP.

**Fase 1 — Organización física**

Creación y gestión de estancias y contenedores.

**Fase 2 — Catálogo**

Creación y administración de tipos de producto y productos.

**Fase 3 — Inventario**

Registro de existencias, incorporación de productos a contenedores, entradas, salidas y traslados.

**Fase 4 — Consultas y búsqueda**

Búsqueda de productos, filtrado por tipos y consulta de existencias y ubicaciones.

**Fase 5 — Funcionalidades adicionales**

Incorporación de funciones que se hayan aprobado posteriormente.

Cada fase deberá disponer de criterios de aceptación verificables.

# CRITERIOS DE CALIDAD

La aplicación deberá cumplir los siguientes principios:

1. **Usabilidad:** las operaciones habituales deben resultar rápidas y comprensibles.
2. **Modularidad:** permitir incorporar funciones sin reestructurar toda la aplicación.
3. **Integridad de datos:** evitar pérdidas, duplicidades accidentales e inconsistencias.
4. **Mantenibilidad:** utilizar código legible, organizado y documentado.
5. **Escalabilidad funcional:** admitir nuevos tipos, productos, ubicaciones y funcionalidades.
6. **Persistencia:** conservar los datos tras cerrar y volver a abrir la aplicación.
7. **Reutilización:** un producto del catálogo podrá referenciarse desde diferentes ubicaciones sin duplicar su definición.
8. **Trazabilidad:** mantener documentadas las decisiones y los cambios importantes.
9. **Calidad técnica:** incorporar pruebas adecuadas y gestionar correctamente los errores.

No introducir complejidad técnica innecesaria.

# CÓMO DEBE SER LA RESPUESTA

En tu primera respuesta, **no comiences a generar código**.

Presenta:

1. Un resumen de lo que has entendido.
2. Un esquema de las dos estructuras: almacenamiento físico y clasificación de productos.
3. Una propuesta del modelo de datos y sus relaciones.
4. Una propuesta de funcionalidades mínimas del MVP.
5. Las decisiones funcionales y técnicas pendientes.
6. Las preguntas imprescindibles para cerrar los requisitos.
7. Un plan de desarrollo por fases.

Distingue claramente entre:

- **REQUISITOS CONFIRMADOS:** establecidos expresamente por el usuario.
- **PROPUESTAS:** funcionalidades o decisiones sugeridas pendientes de aprobación.
- **CUESTIONES ABIERTAS:** aspectos que necesitan una respuesta.

Una vez validada la definición, podremos comenzar la implementación.

# VERIFICACIÓN

Antes de dar una fase por terminada, comprueba que sus funcionalidades funcionan y que se cumplen los criterios de aceptación.

Como mínimo, verifica estos escenarios:

**Organización física**
- Crear "Cocina" y "Despensa".
- Crear "Nevera" y "Armario" en "Cocina".
- Crear "Estantería" en "Despensa".
- Renombrar estancias y contenedores sin perder sus relaciones.
- Trasladar un contenedor entre estancias.

**Catálogo**
- Crear el tipo "Lácteos".
- Crear el tipo "Conservas".
- Dar de alta "Leche entera" dentro de "Lácteos".
- Dar de alta "Atún en conserva" dentro de "Conservas".
- Editar un tipo y comprobar que sus productos conservan la relación.
- Buscar y filtrar productos por tipo.

**Inventario**
- Incorporar 2 unidades de "Leche entera" a la nevera.
- Incorporar 6 unidades del mismo producto al armario.
- Verificar que ambos registros utilizan el mismo producto del catálogo.
- Comprobar que el total es de 8 unidades.
- Retirar 1 unidad de la nevera y verificar que el total es de 7.
- Trasladar 2 unidades del armario a la nevera y verificar que el total sigue siendo 7.
- Comprobar que las operaciones no generan duplicados en el catálogo.
- Comprobar que no se elimina información accidentalmente.
- Cerrar y volver a abrir la aplicación y verificar la conservación de todos los datos.

No declares completada una funcionalidad sin haber comprobado su comportamiento.

Mantén un registro de decisiones, funciones implementadas, pruebas realizadas y tareas pendientes.

**Comienza por la Fase 0: análisis y definición de requisitos.**