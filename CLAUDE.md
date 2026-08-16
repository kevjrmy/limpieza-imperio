# CLAUDE.md

Demo comercial para Limpiezas El Imperio (La Pobla de Vallbona, Valencia).
Lee su libro de Excel de 85 pestañas en el navegador y le enseña el margen real
por cliente. `README.md` explica el porqué de cada decisión; esto es la guía
operativa.

| | |
|---|---|
| Repositorio | `git@github.com:kevjrmy/limpieza-imperio.git` (privado) |
| Producción | https://limpieza-imperio.vercel.app |
| Proyecto en Vercel | `limpieza-imperio`, Root Directory `.` |

**Estado:** terminado y desplegado, pendiente de enseñárselo al cliente. No es
un producto en producción todavía: es la pieza con la que se le vende el
sistema de verdad. Todo lo que se toque tiene que seguir funcionando **con su
archivo real delante de él**, que es el único escenario que importa.

## Git

**Se trabaja siempre sobre `main`. No crees ramas nuevas nunca**, ni para
funcionalidades ni para arreglos: commit directo a `main` y push a `origin`.

## Regla que no se rompe nunca

**Los datos del cliente no entran en git.** `docs/` contiene el libro real con
nombres, direcciones, teléfonos y al menos un DNI. `.gitignore` excluye `docs/`,
`*.xlsx`, `*.xls*`, `*.csv` y `*.local.json`.

Esto se extiende al contenido, no sólo a los archivos: **no cites nombres reales
del libro en el código, en los comentarios, en el README ni en los mensajes de
commit.** Para los ejemplos hay un juego de nombres inventados que ya se usa en
todas partes — ELENA P / ELENA PRADOS / ELENA MOLINA (inicial ambigua),
BEATRIZ / BEATRIZ SOLANO (apellido único), MARIANO / MARIANA (variante de
género), LUCIA, TOMAS RIVAS, NURIA (colaboradores).

Antes de cualquier commit:

```bash
git diff --cached --name-only | grep -Ei '\.(xlsx|xlsm|xls|csv|ods)$|^docs/'
```

Si eso imprime algo, para.

## Estructura

```
app/src/lib/      parser.js agrupar.js metricas.js consultas.js
                  texto.js formato.js db.js sqlite.worker.js
app/src/componentes/   SoltarArchivo · Revision · Panel · AvisoAlmacenamiento
app/scripts/      verificar.mjs · libro-de-prueba.mjs · modelo-2026.mjs
docs/             archivos reales del cliente (fuera de git)
```

La lógica de negocio vive en `app/src/lib/` como módulos puros sin dependencias
de DOM. Por eso el mismo código corre en el navegador y en Node, y por eso
`verificar.mjs` demuestra algo: contrasta lo que la pantalla va a enseñar.

## Verificar antes de dar nada por bueno

Si tocas `parser.js`, `agrupar.js` o `metricas.js`, ejecuta:

```bash
node app/scripts/verificar.mjs "docs/contabilidad limpiezas el imperio 2025-2026.xlsx" --nombres
```

El bloque **LECTURA DEL LIBRO** debe cuadrar exacto: 7 hojas importadas, 14
omitidas, 901 servicios, 75.262,60 € facturados, 67 avisos de año, reparto de
43.244 € con descuadre 0,00 €. Cualquier `FALLA` ahí es una regresión.

El bloque **MÁRGENES DE REFERENCIA** sólo se ejecuta si existe
`app/scripts/referencia.local.json` con la lista de clientes reales contra la
que contrastar. Ese archivo está fuera de git a propósito (`*.local.json`): si
no está, esa comprobación se omite y las demás siguen corriendo.

El bloque **AGRUPACIÓN** se desvía a propósito de la referencia original
(127 vs 129 clusters de clientes, 103 vs 92 de colaboradores). Está justificado
en el README: no lo "arregles" relajando las salvaguardas sin leer por qué.

Sin el archivo real, `libro-de-prueba.mjs` genera un libro sintético con las
mismas rarezas y nombres inventados.

### Probar el sitio desplegado de verdad

Que la página cargue no demuestra nada. Para comprobar el despliegue de punta a
punta sin subir el archivo del cliente a ningún sitio, se construye un libro
sintético **dentro del navegador** reutilizando el propio chunk de SheetJS que
sirve la app, y se mete por el `input` de archivo:

```js
const XLSX = await import('/assets/xlsx-<hash>.js');
// …montar las filas con la maquetación de 2026, escribir con XLSX.write…
const dt = new DataTransfer(); dt.items.add(new File([buf], 'prueba.xlsx'));
const input = document.querySelector('.zona__input');
input.files = dt.files;
input.dispatchEvent(new Event('change', { bubbles: true }));
```

Comprueba las cifras contra el cálculo a mano y que el reparto cuadre a 0,00 €.
Al terminar, vacía la base (`{tipo:'limpiar'}` contra el worker) para no dejar
datos de prueba en OPFS.

## El libro modelo de 2026

`modelo-2026.mjs` reescribe los meses de 2026 del libro real como base de datos
en `.ods`. Es el esquema sobre el que se va a construir de aquí en adelante; el
`.xlsx` de 85 pestañas sigue siendo la entrada de la demo, no se sustituye.

```bash
node app/scripts/modelo-2026.mjs "docs/contabilidad limpiezas el imperio 2025-2026.xlsx"
# → docs/modelo limpiezas el imperio 2026.ods   (fuera de git: lleva datos reales)
```

Diez hojas: `SERVICIOS` (una fila por servicio, 996), `SERVICIO_COLABORADOR`
(quién hizo qué y cuánto cobró, con el reparto en céntimos enteros), `CLIENTES`,
`COLABORADORES`, `MESES`, `GASTOS`, `COSTES_FIJOS`, `FUSIONES_PROPUESTAS`,
`AVISOS` y `LEEME`. Incluye enero de 2026, que la app omite por venir con la
maquetación antigua: el script entiende las dos.

Lo que el script **no** hace, a propósito:

- **No fusiona nombres.** Los `cliente_id` / `colaborador_id` agrupan sólo lo
  idéntico al normalizar. Los parecidos van a `FUSIONES_PROPUESTAS` con una
  columna `aceptada` que rellena una persona. Misma regla de siempre: agrupar de
  menos se arregla luego, agrupar de más destruye datos.
- **No arregla importes.** Las celdas se copian como están; sólo se redondean
  los agregados que calcula el script.
- **No imputa el gasto de empresa al cliente.** Ver abajo.

Dos hallazgos del libro real que el modelo deja a la vista en `AVISOS`, y que
explican **al céntimo** el descuadre de los ocho meses:

- Tres importes (106,25 · 83,33 · 106,25 €) están escritos **como texto**, así
  que el propio total de la hoja no los suma.
- Los totales de cinco meses están montados encadenando celdas a mano
  (`+Q133+Q62+…`) en vez de con `SUM()`, y en cada uno hay una referencia
  repetida: esa fila se cobra dos veces.

## Invariantes del dominio

- **El margen es `valor − (pago_colab + transporte + gasto)`.** Siempre. La
  columna `RENTABILIDAD` del libro se guarda pero no se usa: está escrita a mano
  y no sigue el mismo criterio entre hojas.

  **Pendiente de decidir con el cliente:** el libro modelo se aparta de esto y
  calcula `valor − (pago_colab + transporte)`. Las columnas `VALOR` y `COMERCIO`
  no son el gasto de ese servicio: son las compras del mes (supermercado,
  ferretería, óptica, un KFC) apuntadas en la fila donde había hueco, y se ven
  amontonadas en las primeras filas de cada hoja sin relación con el cliente que
  hay al lado. Sumarlas al coste del servicio le carga el gasto a quien no lo
  causó. En el modelo viven en `GASTOS`, por mes, y el resultado mensual sí las
  descuenta. **La app sigue con el criterio de arriba hasta que él lo confirme.**
- **Los campos se resuelven por texto de cabecera, nunca por índice de columna.**
  Las columnas se mueven entre hojas y una no tiene `TRANSPORTE` en absoluto.
- **La maquetación se detecta por columnas, no por el nombre de la hoja.** Hay
  una hoja de 2026 con la maquetación antigua.
- **Avisar, nunca corregir en silencio.** Años que no cuadran, columnas
  ausentes, hojas omitidas: todo se enseña. Un número silenciosamente arreglado
  es peor que un número marcado.
- **Agrupar de menos se arregla en pantalla; agrupar de más destruye datos.**
  Ante la duda, no fusionar.
- El reparto de pagos se hace en céntimos enteros (`repartir()` en
  `metricas.js`) para que la suma cuadre exacta con el libro.

## Restricciones técnicas

- **SQLite tiene que quedarse en el worker.** OPFS usa `Atomics.wait`, prohibido
  en el hilo principal. Además, el `exports` de `@sqlite.org/sqlite-wasm` impide
  importar en profundidad su worker propio: por eso hay uno a medida.
- OPFS exige `COOP: same-origin` + `COEP: require-corp`, puestas en
  `app/vite.config.js` (server y preview) y en `vercel.json`. Si faltan, la base
  cae a memoria y **la interfaz lo dice**; no quites ese aviso.
- **`vercel.json` vive en la raíz y el Root Directory del proyecto está en su
  valor por defecto.** Los dos ajustes están acoplados de una forma que no se ve
  hasta que falla: **los comandos de `vercel.json` se ejecutan desde el Root
  Directory, no desde la raíz del repositorio.** Con el Root Directory por
  defecto, `--prefix app` y `app/dist` apuntan bien. Si alguien lo cambia a
  `app`, esos mismos comandos resuelven a `app/app` y el build muere con un
  ENOENT (pasó en b21d1cd y 9c0b0df).

  Antes de tocar nada de esto, valida el build **localmente con el pipeline de
  Vercel**, que reproduce el fallo sin gastar un despliegue:

  ```bash
  vercel pull --yes --environment production
  vercel build --prod
  ```

  Después, comprueba **las dos cosas**: que el despliegue termina en `success`
  (`vercel ls limpieza-imperio`) y que `crossOriginIsolated === true` en la
  consola del sitio. Mirar sólo las cabeceras engaña: si el build falla, Vercel
  sigue sirviendo el despliegue anterior, con sus cabeceras intactas.

  `vercel.json` se valida contra un esquema que rechaza propiedades
  desconocidas: no metas claves `"//"` a modo de comentario.
- SheetJS se instala desde el CDN oficial. El paquete `xlsx` de npm está
  abandonado en la 0.18.5 — no lo "actualices" a él.

## Estilo

- **CSS plano en `app/src/estilos.css`. Nada de Tailwind ni SASS.**
- Estética de libro de cuentas: reglas finas, `tabular-nums`, dinero
  monoespaciado y a la derecha. **Color sólo para dos cosas: el margen y lo que
  hay que revisar.** No añadas colores decorativos.
- En las tablas, las reglas de estructura van con `:where()` para no ganarle en
  especificidad a las utilidades (`.num`, `.dinero`). Ya rompió la alineación
  una vez.
- **Toda la interfaz y todo el código —nombres, comentarios, commits— en
  español.**
- Responsive hasta móvil, foco visible y `prefers-reduced-motion` respetado.

## Arrancar

```bash
npm install --prefix app && npm run dev --prefix app   # http://localhost:5174
```
