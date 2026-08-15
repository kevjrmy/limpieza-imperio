# Limpiezas El Imperio — demo de contabilidad

Demo para Limpiezas El Imperio (La Pobla de Vallbona, Valencia). Sustituye un
libro de Excel de 85 pestañas que se mantiene a mano cada mes.

Tres pantallas: **soltar el archivo → revisar la importación → panel.** No hay
datos de ejemplo: el cliente suelta su propio libro y ve sus propias cifras.
Todo ocurre en el navegador; el archivo no se sube a ningún sitio.

## Datos del cliente

`docs/` contiene el libro real y una exportación en CSV. **No están en git y no
deben estarlo**: llevan nombres, direcciones, teléfonos y al menos un DNI. El
`.gitignore` excluye `docs/`, `*.xlsx` y `*.csv` desde el primer commit.

## Arrancar

```bash
npm install --prefix app && npm run dev --prefix app
```

La app queda en `http://localhost:5174`.

## Comprobar las cifras

El parser se puede contrastar contra el libro real sin abrir el navegador:

```bash
node app/scripts/verificar.mjs "docs/contabilidad limpiezas el imperio 2025-2026.xlsx" --nombres
```

Usa exactamente los mismos módulos que la interfaz. Estado actual:

| Comprobación | Resultado |
|---|---|
| Hojas importadas / omitidas | 7 / 14 ✅ |
| Servicios | 901 ✅ |
| Total facturado | 75.262,60 € ✅ |
| Filas con año cruzado | 67 ✅ |
| Reparto por colaborador | 43.244 €, descuadre 0,00 € ✅ |

Los márgenes de referencia también salen: los dos clientes más rentables rondan
el 50 % y los tres que dan pérdidas salen en negativo, uno de ellos a −64,3 %
sobre 11 servicios.

Esa última comprobación necesita los nombres reales de esos clientes, así que
**no viven en el repositorio**. Créalos en un archivo local que `.gitignore`
excluye:

```jsonc
// app/scripts/referencia.local.json
{ "clientes": ["...", "...", "..."] }
```

Sin ese archivo, el resto de comprobaciones se ejecutan igual y esa se omite.

La agrupación de nombres se desvía de la referencia; está explicado más abajo.

Para probar la interfaz sin tocar el archivo del cliente hay un libro sintético
con las mismas rarezas y nombres inventados:

```bash
node app/scripts/libro-de-prueba.mjs app/public/libro-de-prueba.xlsx
```

## Cómo se lee el libro

Sólo se importan las hojas de 2026. Se detectan por sus **columnas**, no por su
nombre: `CLIENTES ENERO DE 2026` usa la maquetación antigua pese al año, y se
queda fuera.

- Se miran las hojas cuyo nombre empieza por `CLIENTES`.
- La fila de cabecera se busca en las 20 primeras (aparece en la 7 y en la 11).
- Los textos de cabecera se normalizan antes de comparar: sin acentos, en
  mayúsculas y con los espacios colapsados. Vienen con espacios dobles y finales.
- **Maquetación 2026** = tiene `VALOR DEL SERVICIO` *y* `COLABORADORES`.
  La antigua usa `VALOR` / `HORAS` / `RESPONSABLE LIMPIEZA` y se lista por nombre
  en la pantalla de revisión.
- **Cada campo se resuelve por texto de cabecera, nunca por índice de columna.**
  Las columnas se mueven entre hojas y `CLIENTES FEBRERO DE 2026` no tiene
  `TRANSPORTE`: se toma como 0 y se avisa.
- La lectura **se detiene** en la fila cuyo `DIA` contiene `TOTAL`; debajo hay un
  bloque de sumas escrito a mano.
- Las filas sin nombre de cliente se descartan (unas 180 de relleno).
- Un año de fila que no coincide con el de la hoja **se avisa, nunca se corrige**.
  Son 67 y son datos reales que él necesita ver.

`COLABORADORES` es una celda de texto libre con una o varias personas dentro
(`"LUCIA"`, `"LUCIA MENDEZ, TOMAS RIVAS"`, `"TOMAS-NURIA"`, `"LUCIA M - NURIA"`).
Se parte por `,` `/` `;` `-` y se descarta lo que no es gente: `ASPIRADORA`,
`CON VAPORETA`, números sueltos, caracteres sueltos.

## Agrupación de nombres

El nombre es la única clave de unión y es texto libre. Dos niveles:

- **Exacto** — iguales al normalizar. Se unen solos.
- **Propuesto** — probablemente la misma persona. Se propone; decide él.

Se propone cuando, sobre cadenas normalizadas de ≥6 caracteres, una es prefijo
de la otra, o la distancia de Levenshtein es ≤2 y ≤20 % de la más larga.

Dos salvaguardas:

1. **Nombre de pila compartido sin apellido que desempate → no se propone.**
   `ELENA P`, `ELENA M`, `ELENA PRADOS` y `ELENA MOLINA` pueden ser cuatro
   personas distintas. La regla mira cuántos apellidos distintos cuelgan de ese
   nombre de pila en todo el libro: si hay más de uno, la inicial es ambigua y
   se bloquea. Con un solo apellido en juego (`BEATRIZ` / `BEATRIZ SOLANO`) sí
   se propone.
2. **Variantes de género → baja confianza.** `MARIANO`/`MARIANA`,
   `RAMON`/`RAMONA` suelen ser personas distintas. No se descartan —él conoce a
   su gente— pero se marcan y salen las primeras.

El nombre canónico es la variante más usada. En la pantalla de revisión **todas
las propuestas vienen aceptadas**: desmarcar lo que sobra es más barato que
marcar decenas de casillas para llegar al panel.

### Dónde nos separamos de la referencia

Las cifras de lectura cuadran exactamente. Las de agrupación no:

| | Esta implementación | Referencia |
|---|---|---|
| Clientes: familias a revisar | 19 | 18 |
| Clientes: clusters finales | 127 | 129 |
| Colaboradores: familias a revisar | 24 | 29 |
| Colaboradores: clusters finales | 103 | 92 |

Dos diferencias de criterio, ambas deliberadas:

- **Una propuesta es una familia entera, no un par.** Tres variantes de un
  mismo nombre se revisan en una sola línea, no en dos preguntas encadenadas
  sobre lo mismo.
- **Se agrupa menos de lo que agrupa la referencia**, sobre todo en
  colaboradores. La salvaguarda del nombre de pila bloquea los casos en que un
  nombre suelto podría ser cualquiera de dos apellidos distintos que aparecen en
  el libro. Con la regla relajada aparecían fusiones claramente malas: seis
  personas distintas que comparten nombre de pila colapsadas en una sola por
  culpa de una aparición del nombre a secas.

El criterio es que **agrupar de menos se arregla en pantalla y agrupar de más
destruye datos en silencio**, que es justo lo que la salvaguarda del nombre de
pila existe para evitar. Ejecuta `verificar.mjs --nombres` para ver las 43
familias propuestas una por una; todas son defendibles.

## Panel

El margen se calcula **siempre** como:

```
margen = valor − (pago_colab + transporte + gasto)
```

La columna `RENTABILIDAD` del libro se guarda pero **no se usa**: está escrita a
mano y no sigue el mismo criterio entre hojas.

Tres tablas: mes a mes, margen por cliente (descendente) y pagos por
colaborador. Cuando un servicio lleva varias personas, el pago se reparte entre
ellas en céntimos enteros, de modo que la suma del reparto es idéntica al total
del libro (43.244 €, descuadre 0,00 €).

Los clientes en pérdidas salen destacados arriba del todo: son el argumento de
venta de la demo.

## Esquema

`clientes`, `trabajadores`, `servicios` y la tabla de unión
`servicio_trabajador` — un servicio puede llevar varios colaboradores, que es
exactamente lo que la celda apretujada del Excel debería haber sido.

Cada servicio conserva `origen_hoja` y `origen_fila`, así que cualquier cifra
del panel se puede rastrear hasta una línea concreta de su archivo.

## Notas técnicas

- **SheetJS** se instala desde el CDN oficial
  (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`); el paquete `xlsx` de
  npm está abandonado en la 0.18.5.
- **SQLite corre en un web worker.** No es una preferencia: el backend OPFS usa
  `Atomics.wait`, que el navegador prohíbe en el hilo principal.
- OPFS necesita `Cross-Origin-Opener-Policy: same-origin` y
  `Cross-Origin-Embedder-Policy: require-corp`. Están puestas en
  `app/vite.config.js` (server y preview) y en `vercel.json`. Sin ellas la base
  cae a memoria y **la interfaz lo dice** en vez de perder la importación en
  silencio.
- **`vercel.json` va en la raíz y el Root Directory del proyecto se queda en el
  valor por defecto.** La instalación y la compilación se delegan a `app/` y la
  salida se declara en `outputDirectory`, así que toda la configuración del
  despliegue está versionada y no depende de un ajuste del panel.
- Si alguien pone el Root Directory en `app`, Vercel deja de encontrar ese
  archivo y se pierden las cabeceras **sin que falle el despliegue**: el sitio
  parece correcto y OPFS cae a memoria, perdiendo la importación al recargar. Se
  comprueba mirando `crossOriginIsolated` en la consola del sitio desplegado.
- Si al arrancar hay una importación guardada, se ofrece retomarla. El panel se
  reconstruye entonces con consultas SQL (`app/src/lib/consultas.js`), que dan
  las mismas cifras que el cálculo en memoria.
- CSS plano, sin Tailwind ni SASS. Responsive, foco visible y
  `prefers-reduced-motion` respetado.
