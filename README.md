# Limpiezas El Imperio — contabilidad

Sistema de contabilidad de Limpiezas El Imperio (La Pobla de Vallbona,
Valencia). Sustituye a un libro de Excel de 85 pestañas que se mantenía a mano
cada mes.

**Un solo negocio y un solo usuario.** Frank entra con su cuenta, lleva sus
servicios, clientes, colaboradores y gastos, adelanta el mes siguiente a partir
de lo que se repite, y se lleva el mes entero en un CSV.

**En producción:** https://limpieza-imperio.vercel.app

Este archivo explica **por qué** cada cosa es como es. `CLAUDE.md` es la guía
operativa: cómo arrancarlo, qué comprobar y qué no romper.

## Cómo se llegó hasta aquí

Tres piezas, en este orden:

1. **El libro real** (`.xlsx`, 85 pestañas, dos años, dos maquetaciones
   distintas conviviendo). No se toca: es la fuente.
2. **El libro modelo** (`.ods`, generado por `scripts/modelo-2026.mjs`). Los
   ocho meses de 2026 reescritos como base de datos, con los avisos de todo lo
   que no cuadraba. Es la semilla.
3. **El sistema** (esto). Arranca sembrado desde el modelo y a partir de ahí él
   edita aquí. **Ya no se importa ningún Excel.**

Los scripts que leen el `.xlsx` siguen existiendo como herramienta de línea de
comandos, no como parte del producto.

## Datos del cliente

`docs/` contiene el libro real y sus derivados. **No están en git y no deben
estarlo**: llevan nombres, direcciones, teléfonos y al menos un DNI. El
`.gitignore` excluye `docs/`, `*.xlsx`, `*.csv`, `*.ods` y `*.local.json`.

La regla se extiende al contenido: **ningún nombre real del libro aparece en el
código, los comentarios, este archivo ni los mensajes de commit.** Para los
ejemplos hay un juego de nombres inventados que se usa en todas partes — ELENA P
/ ELENA PRADOS / ELENA MOLINA (inicial ambigua), BEATRIZ / BEATRIZ SOLANO
(apellido único), MARIANO / MARIANA (variante de género), LUCIA, TOMAS RIVAS,
NURIA (colaboradores).

## Qué se encontró en su libro

Dos errores reales, que el modelo deja a la vista y explican **al céntimo** el
descuadre de los ocho meses:

- **Tres importes escritos como texto** (106,25 · 83,33 · 106,25 €). Excel no
  los suma, así que el propio total de la hoja se queda corto y nada lo indica.
- **Cinco totales montados encadenando celdas a mano** (`+Q133+Q62+…`) en vez de
  con `SUM()`, cada uno con una referencia repetida: esa fila se cobra dos
  veces. Son 285 € de más en el año.

Y una decisión de criterio que le cambia el margen por cliente:

- **Las columnas `VALOR` y `COMERCIO` no eran el gasto de ese servicio.** Eran
  las compras del mes —supermercado, ferretería, óptica— apuntadas en la fila
  donde había hueco, amontonadas en las primeras filas de cada hoja sin relación
  con el cliente de al lado. Sumarlas al coste del servicio le carga el gasto a
  quien no lo causó. Ahora viven en su propia tabla y se descuentan del mes.
  **Pendiente de confirmarlo con él la primera vez que lo vea.**

## El margen

```
margen = valor − (pago_colab + transporte)
```

No se escribe en ninguna parte: es una **columna generada** de la tabla
`servicios`. El criterio vive en el esquema, en un solo sitio, y no puede
quedarse desfasado respecto a los importes — que es exactamente lo que le pasaba
a la columna `RENTABILIDAD` del Excel, escrita a mano y sin el mismo criterio
entre hojas. Esa columna no se importó.

Cuando un servicio lo hacen varias personas, el pago **se reparte en céntimos
enteros**, de modo que la suma de las partes es idéntica al pago del servicio.
En los 996 servicios sembrados: 47.474 € repartidos, descuadre 0,00 €.

## Preparar el mes

El negocio es rutinario: alguien va a casa de un cliente todos los lunes, y el
mes que viene irá otra vez todos los lunes. Frank reescribía a mano ciento y
pico filas casi idénticas cada mes.

`/preparar` mira el mes anterior, encuentra esas rutinas y deja el siguiente
escrito en **borrador**. Proyectando julio sobre agosto salen **141 servicios
propuestos contra los 139 que hubo de verdad**, a partir de 32 rutinas.

Cómo se decide qué se repite:

- Se agrupa por **cliente y día de la semana**, dividido entre las veces que ese
  día cae en el mes. Sin eso, un edificio con 13 servicios en viernes generaba 13
  filas el mismo día en vez de 3 por viernes.
- **Lo que ocurrió una sola vez no se copia.** En ese mismo mes son 49 trabajos
  sueltos: un trabajo suelto no es una rutina, y proponerlo es darle filas que
  borrar.
- El importe, las horas y la hora salen del **valor más repetido**.
- **Quién lo hace sólo se propone si hay una persona claramente habitual** — 15
  de esas 32 rutinas. El resto rota demasiado: hay un cliente con cinco
  servicios hechos por cinco personas distintas. Rellenarlo a ciegas acertaría
  poco, y corregir cuesta más que escribir.

Él ve el análisis **antes** de generar, genera, revisa, edita y confirma. O lo
descarta y vuelve a empezar.

**Un borrador no cuenta para nada hasta que lo confirma** — ni margen, ni
cierre, ni exportación. Y eso no depende de acordarse de poner un `WHERE`: la
vista `v_servicios` los filtra y **todos los agregados leen de ella**. La única
lectura que va contra la tabla es la lista de servicios, que es justo donde hay
que verlos.

## Exportar

Un CSV por tabla, y **el mes entero en un solo archivo** con servicios, resumen
por cliente, resumen por colaborador, gastos, costes fijos y el cierre, en
bloques uno debajo de otro. Es la maquetación que ya tenía en Excel: la tabla y,
debajo, los totales.

El formato no es una elección estética. Su propia exportación de Excel llegaba
en cp1252 (`AÑO` → `A?O`, el símbolo del euro roto), con los importes como texto
(`150,00 €`) y con 83,333 recortado a 83,33. Así que:

- **UTF-8 con BOM.** Sin el BOM, Excel en Windows asume la codificación del
  sistema y se come los acentos y las eñes.
- **Separador punto y coma.** En un Windows en español la coma es el separador
  decimal; un CSV separado por comas se abre todo en una columna.
- **Números con coma decimal, sin símbolo de moneda ni separador de millares**,
  y sin recortar decimales. Así Excel los reconoce como números y se pueden
  sumar.

Comprobado abriéndolo con LibreOffice en locale español: acentos intactos y
`83,333` leído como el número 83.333.

## Cómo se lee su Excel (sólo para sembrar)

Vale para `modelo-2026.mjs` y `verificar.mjs`, no para la aplicación.

- Se miran las hojas cuyo nombre empieza por `CLIENTES`.
- La fila de cabecera se busca en las 20 primeras (aparece en la 7 y en la 11).
- Los textos de cabecera se normalizan antes de comparar: sin acentos, en
  mayúsculas y con los espacios colapsados. Vienen con espacios dobles y finales.
- **La maquetación se detecta por columnas, no por el nombre de la hoja.**
  `CLIENTES ENERO DE 2026` usa la maquetación antigua pese al año. El generador
  del modelo entiende las dos, así que enero de 2026 entra; la demo antigua lo
  omitía.
- **Cada campo se resuelve por texto de cabecera, nunca por índice de columna.**
  Las columnas se mueven entre hojas y una no tiene `TRANSPORTE` en absoluto: se
  toma como 0 y se avisa.
- La lectura **se detiene** en la fila cuyo `DIA` contiene `TOTAL`; debajo hay un
  bloque de sumas escrito a mano, que se lee aparte.
- Las filas sin nombre de cliente se descartan. Las que no tienen nombre **pero
  sí dinero** se avisan: son servicios que han perdido a su cliente.
- Un año de fila que no coincide con el de la hoja **se avisa, nunca se
  corrige.**

`COLABORADORES` es una celda de texto libre con una o varias personas dentro
(`"LUCIA"`, `"LUCIA MENDEZ, TOMAS RIVAS"`, `"TOMAS-NURIA"`, `"LUCIA M - NURIA"`).
Se parte por `,` `/` `;` `-` y se descarta lo que no es gente: `ASPIRADORA`,
`CON VAPORETA`, números sueltos, caracteres sueltos.

Además, las cabeceras de 2026 **van corridas una columna** respecto a sus
valores a partir de `PAGADO`: el OK/PTE aparece bajo «DESCRIPCION DEL SERVICIO»
y la hora bajo «PAGO DEL CLIENTE». En el modelo se colocan bajo el nombre que
les corresponde por contenido.

### Comprobar que sigue cuadrando

```bash
node scripts/verificar.mjs "docs/<libro real>.xlsx" --nombres
```

| Comprobación | Resultado |
|---|---|
| Hojas importadas / omitidas | 7 / 14 ✅ |
| Servicios | 901 ✅ |
| Total facturado | 75.262,60 € ✅ |
| Filas con año cruzado | 67 ✅ |
| Reparto por colaborador | 43.244 €, descuadre 0,00 € ✅ |

Son las cifras de las 7 hojas con maquetación de 2026. El modelo añade enero,
así que el año entero son 996 servicios y 82.865,60 €.

`npm run sembrar` contrasta lo insertado contra el propio `.ods` y **sale con
error si algo no cuadra**: una siembra a medias es peor que ninguna.

## Agrupación de nombres

El nombre era la única clave de unión en el Excel, y es texto libre. Dos
niveles:

- **Exacto** — iguales al normalizar. Se unen solos.
- **Propuesto** — probablemente la misma persona. Se propone; decide él, en
  `/revisar`.

Se propone cuando, sobre cadenas normalizadas de ≥6 caracteres, una es prefijo
de la otra, o la distancia de Levenshtein es ≤2 y ≤20 % de la más larga.

Dos salvaguardas:

1. **Nombre de pila compartido sin apellido que desempate → no se propone.**
   `ELENA P`, `ELENA M`, `ELENA PRADOS` y `ELENA MOLINA` pueden ser cuatro
   personas distintas. La regla mira cuántos apellidos distintos cuelgan de ese
   nombre de pila: si hay más de uno, la inicial es ambigua y se bloquea. Con un
   solo apellido en juego (`BEATRIZ` / `BEATRIZ SOLANO`) sí se propone.
2. **Variantes de género → baja confianza.** `MARIANO`/`MARIANA`,
   `RAMON`/`RAMONA` suelen ser personas distintas. No se descartan —él conoce a
   su gente— pero se marcan y salen las primeras.

**Nada se fusiona solo.** Los identificadores agrupan únicamente lo idéntico al
normalizar; las 46 propuestas esperan en la tabla `fusiones` hasta que él las
acepta. Aplicar una mueve historial de un nombre a otro y borra el que sobra:
eso no se deshace.

El criterio es que **agrupar de menos se arregla en pantalla y agrupar de más
destruye datos en silencio**. Con la regla del nombre de pila relajada aparecían
fusiones claramente malas: seis personas distintas colapsadas en una por culpa
de una aparición del nombre a secas.

## Autenticación

**Todo detrás del login. No hay parte pública.**

La sesión se comprueba **en cada recurso que toca datos** —cada consulta, cada
acción, cada descarga— y no sólo en el proxy. No es celo: comprobarlo sólo en el
layout **no funciona**. Next renderiza la página aparte del layout, así que un
layout que decide no pintar `children` igualmente ha ejecutado la página y ha
serializado su resultado en la carga RSC. Se probó, y por esa vía salían nombres
y direcciones de clientes en `/servicios`. Es también lo que recomienda Clerk
desde la v7, que por eso marcó `createRouteMatcher` como obsoleto.

Sin claves de Clerk: en local se pasa sin autenticar y **la cabecera lo anuncia
con una banda**; en producción la aplicación **se niega a servirse**. Son datos
reales de clientes: quedarse abierta por un despiste de variables de entorno no
es una opción.

El registro de Clerk está abierto, así que quien de verdad cierra la puerta es
la lista `CORREOS_AUTORIZADOS`: cualquier cuenta fuera de ella se rechaza.

## Esquema

`clientes`, `colaboradores`, `servicios` y la tabla de unión
`servicio_colaborador` — un servicio puede llevar varias personas, que es
exactamente lo que la celda apretujada del Excel debería haber sido. Aparte:
`gastos`, `costes_fijos`, `cierres`, `avisos` y `fusiones`.

Cada fila sembrada conserva su `origen` (`CLIENTES AGOSTO 2026!86`), así que
cualquier cifra se puede rastrear hasta una línea concreta de su archivo.

Los importes son `REAL`, no céntimos enteros. Suena mal para contabilidad, pero
él escribe 83,333 € —un tercio de 250— y redondear a céntimos le cambiaría los
totales del año sin avisar. Donde el redondeo sí se nota, el reparto entre
colaboradores, se trabaja en céntimos enteros.

## Notas técnicas

- **SQLite en los dos lados**: Turso (libSQL) en producción y un archivo local
  en desarrollo. Mismo cliente, mismo dialecto, mismas consultas — lo que se
  prueba en local es lo que corre desplegado.
- **`src/proxy.js`, no `middleware.js`.** Next 16 renombró la convención. El
  proxy sólo deja la sesión disponible; no decide quién entra.
- **No puede haber una carpeta `app/` en la raíz**: Next la tomaría como
  directorio de rutas en lugar de `src/app`.
- **`consultas.js` no se puede importar desde un componente de cliente**:
  arrastra el módulo de sesión, que es sólo de servidor. Lo compartido vive en
  `formato.js`, que es puro.
- **`vercel.json` sólo declara el framework, y hace falta.** El proyecto se creó
  como Vite y esa preferencia sigue guardada en Vercel; sin esa clave el build
  termina bien y el despliegue muere buscando una carpeta `dist`.
- **SheetJS es dependencia de desarrollo**, no de la aplicación: lo usan los
  scripts. Se instala desde el CDN oficial; el paquete `xlsx` de npm está
  abandonado en la 0.18.5.
- CSS plano en un solo archivo, sin Tailwind ni SASS. Estética de libro de
  cuentas: reglas finas, `tabular-nums`, dinero monoespaciado y a la derecha, y
  **color sólo para dos cosas: el margen y lo que hay que revisar**. Responsive,
  foco visible y `prefers-reduced-motion` respetado.
- Toda la interfaz y todo el código —nombres, comentarios, commits— en español.

## Lo que queda

- Enseñárselo, y confirmar con él el criterio del gasto de empresa.
- Pasar Clerk a instancia de producción: ahora usa claves de prueba
  (`accounts.dev`), lo que pide un dominio propio.
- Cerrar el registro en el panel de Clerk, para no depender sólo de la lista de
  correos autorizados.
