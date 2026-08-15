# CLAUDE.md

Demo comercial para Limpiezas El Imperio (La Pobla de Vallbona, Valencia).
Lee su libro de Excel de 85 pestañas en el navegador y le enseña el margen real
por cliente. `README.md` explica el porqué de cada decisión; esto es la guía
operativa.

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
git diff --cached --name-only | grep -Ei '\.(xlsx|xlsm|xls|csv)$|^docs/'
```

Si eso imprime algo, para.

## Estructura

```
app/src/lib/      parser.js agrupar.js metricas.js consultas.js
                  texto.js formato.js db.js sqlite.worker.js
app/src/componentes/   SoltarArchivo · Revision · Panel · AvisoAlmacenamiento
app/scripts/      verificar.mjs · libro-de-prueba.mjs
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

El bloque **AGRUPACIÓN** se desvía a propósito de la referencia original
(127 vs 129 clusters de clientes, 103 vs 92 de colaboradores). Está justificado
en el README: no lo "arregles" relajando las salvaguardas sin leer por qué.

Sin el archivo real, `libro-de-prueba.mjs` genera un libro sintético con las
mismas rarezas y nombres inventados.

## Invariantes del dominio

- **El margen es `valor − (pago_colab + transporte + gasto)`.** Siempre. La
  columna `RENTABILIDAD` del libro se guarda pero no se usa: está escrita a mano
  y no sigue el mismo criterio entre hojas.
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
- **`vercel.json` vive en la raíz y el Root Directory del proyecto se queda en
  el valor por defecto.** Los dos ajustes están acoplados: Vercel sólo lee el
  `vercel.json` que cae bajo el Root Directory. Si alguien lo pone en `app`,
  deja de encontrarlo, se pierden las cabeceras y OPFS cae a memoria **sin que
  falle el despliegue** — el sitio parece correcto y la importación se pierde al
  recargar.

  La instalación y la compilación se delegan a `app/` (`--prefix app`) y la
  salida se declara en `outputDirectory`.

  Tras tocar el archivo o el ajuste, abre el sitio desplegado y comprueba
  `crossOriginIsolated === true` en la consola. Es la única señal: no hay build
  en rojo que avise.

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
