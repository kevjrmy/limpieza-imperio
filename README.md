# Limpiezas El Imperio — contabilidad

Sistema de contabilidad de Limpiezas El Imperio (La Pobla de Vallbona,
Valencia). Sustituye a un libro de Excel de 85 pestañas que se mantenía a mano
cada mes.

**Un solo negocio y un solo usuario.** El dueño entra con su cuenta, lleva sus
servicios, clientes, colaboradores y gastos, adelanta el mes siguiente a partir
de lo que se repite, y se lleva el mes entero en un CSV.

**En producción:** https://limpiezas-imperio.vercel.app

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
mes que viene irá otra vez todos los lunes. Él reescribía a mano ciento y pico
filas casi idénticas cada mes.

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

**Sólo sale lo confirmado**: todas las consultas de exportación leen la vista
`v_servicios`, que deja fuera los borradores. Los de clientes, colaboradores y
servicios llevan además la columna `Nº`, para poder cruzar dos archivos sin
depender de que el nombre esté escrito igual en los dos.

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

### Poder señalar a una

Agrupar de menos deja, a propósito, fichas parecidas conviviendo. Para que eso
no sea un problema en pantalla, **cada cliente y cada colaborador enseña su
número** —`#047`— en su tabla, en la ficha, en los desplegables del formulario
de servicio y en los CSV. Dos `BEATRIZ SOLANO` dejan de ser indistinguibles en
el momento de elegir, que es donde nacía el duplicado siguiente.

El número sale del `id`, no de la columna `ref`. `ref` guarda el código del
libro modelo (`CLI-001`) y sólo la rellena el sembrador: lo dado de alta desde
la aplicación la tiene vacía, o sea justo la gente más reciente. El `id` no
falta nunca y ya es lo que va en la dirección, así que `#047` y `/clientes/47`
son el mismo número.

Que quede claro lo que **no** hace: no impide crear duplicados. Dos fichas de la
misma persona tienen dos números. Sirve para distinguirlas y para decidir sobre
ellas; unirlas sigue siendo cosa de `/revisar`.

### Buscar

Las tres cajas de búsqueda —servicios, clientes, colaboradores— **ignoran los
acentos** y aceptan también el número de ficha (`47`, `#47`, `047`). Dos años de
nombres escritos a mano en una comarca donde conviven el castellano y el
valenciano dan `NÚRIA`, `TOMÀS`, `LLUÏSA`, `GONÇAL`, y quien busca no tiene por
qué acordarse de cómo quedó escrito.

El plegado se hace en JavaScript con la misma `clave()` que usa la agrupación,
de modo que buscar y agrupar entienden lo mismo por «el mismo nombre».
Intentarlo en SQL no sale: plegar acentos con `REPLACE` anidados pide 44 niveles
y SQLite corta en 29 con `parser stack overflow`.

## Autenticación

**Todo detrás del login. No hay parte pública.**

La sesión se comprueba **en cada recurso que toca datos** —cada consulta, cada
acción, cada descarga— y no sólo en el proxy. No es celo: comprobarlo sólo en el
layout **no funciona**. Next renderiza la página aparte del layout, así que un
layout que decide no pintar `children` igualmente ha ejecutado la página y ha
serializado su resultado en la carga RSC. Se probó, y por esa vía salían nombres
y direcciones de clientes en `/servicios`. La única barrera que no se puede
esquivar es la que está pegada a los datos.

Sin las variables puestas: en local se pasa sin autenticar y **la cabecera lo
anuncia con una banda**; en producción la aplicación **se niega a servirse**. Son
datos reales de clientes: quedarse abierta por un despiste de variables de
entorno no es una opción.

### Un usuario, una contraseña, y nada más

Esto lo llevó Clerk hasta agosto de 2026. Se quitó y se escribió a mano, porque
Clerk resolvía un problema que este negocio no tiene —registro, invitaciones,
roles, recuperación por correo, varias organizaciones— y cobraba por ello un
precio que sí se notaba: la sesión vivía en `accounts.dev`, un dominio de
terceros, y pasarla al servidor dependía de cookies entre sitios que Safari en
el móvil corta. De ahí salía el bucle de redirecciones que él sufrió. Y para
salir de las llaves de prueba hacía falta un dominio propio.

Lo que hay ahora cabe en dos verbos, entrar y salir:

- **Tres variables de entorno.** `USUARIO` es el nombre de usuario —resulta que
  tiene forma de correo, pero no se le manda ningún correo nunca—, `CLAVE_HASH`
  es la contraseña pasada por `scrypt`, y `SESION_SECRETO` firma las cookies.
  Se generan con `npm run clave`.
- **La base de datos no participa.** No hay tabla de usuarios ni de sesiones: la
  sesión es una cookie firmada que dice cuándo caduca. Eso significa que la
  autenticación **no puede escribir nada** en la base del cliente, que es la
  única copia que existe de su contabilidad. Un fallo aquí puede dejarle fuera;
  no puede corromperle los datos.
- **Treinta días deslizantes.** El proxy vuelve a firmar la cookie cuando lleva
  más de un día emitida, así que usándola nunca vuelve a ver la pantalla de
  entrada. Sólo caduca tras un mes sin abrirla.
- **La cookie es de este dominio**, `HttpOnly`, `SameSite=Lax` y `Secure` en
  cuanto hay https. Sin terceros de por medio, el bucle de antes ya no puede
  darse: hay una sola fuente de verdad, y si el servidor no reconoce la sesión
  es que no la hay.
- **No hay recuperación de contraseña, y es a propósito.** No hay pantalla de
  perfil, no se cambia la contraseña desde dentro y no se manda ningún correo.
  Si se pierde, se genera otra con `npm run clave` y se cambia en Vercel.
- **Cerrar todas las sesiones** = cambiar `SESION_SECRETO` en Vercel. La clave
  de firma se deriva de las tres variables juntas, así que tocar cualquiera de
  ellas invalida en el acto todas las cookies emitidas. Es el botón de
  emergencia si pierde el móvil, y de paso hace que cambiar la contraseña cierre
  las sesiones abiertas sin que haya que acordarse de nada.

Lo que se pierde respecto a Clerk: no se puede cerrar **una** sesión concreta
—se cierran todas o ninguna—, no hay segundo factor, y el freno a la fuerza
bruta se cuenta en memoria del proceso, así que frena a quien pruebe en serie y
no a quien reparta los intentos entre instancias. Nada de eso sostiene la
seguridad de esto: la sostiene una contraseña de veinticuatro caracteres
aleatorios, que son unos 139 bits.

## Las fichas, y por qué no son dos casillas de texto

Pidió dos cosas el mismo día, y las dos son «añadir campos». Se resolvieron
distinto a propósito.

**En el cliente, quién suele ir.** Lo dijo como «el nombre del trabajador y su
teléfono». Es una **referencia** a `colaboradores`, elegida de un desplegable, y
el teléfono **no se copia**: se lee de la ficha de esa persona y en el formulario
sale como texto, no como campo. Escrito a mano, el número de una misma persona
quedaría en hasta siete fichas de cliente —ése es el máximo real en sus datos— y
el día que cambiara no habría nada que avisara de las otras seis. Es la misma
regla que el margen: el dato vive en un sitio.

Queda opcional, y lo estará casi siempre: sólo el 23 % de sus clientes ha tenido
siempre a la misma persona, y más de la mitad han visto pasar a tres o más.
Obligar a rellenarlo sería obligar a inventárselo — el mismo motivo por el que
el generador de recurrencias tampoco propone colaborador.

Cuando quien elige no tiene teléfono apuntado, se dice en ámbar con un enlace a
su ficha. De sus 154 colaboradores sólo 2 lo tenían, así que al principio sale
casi siempre, y un hueco en blanco se lee como una avería.

**En el colaborador, dónde vive.** Dirección, barrio y provincia, en tres
campos. El barrio es lo que de verdad usa para repartir el trabajo —quién pilla
cerca de qué cliente— y dentro de una línea de texto libre no hay manera de
mirarlo de un vistazo. En la tabla van juntos en una sola columna.

El cliente no tiene barrio ni provincia, y no es un olvido: la dirección del
cliente **es** el sitio al que se va, no dónde vive nadie.

**Que sea una referencia y no un texto tiene una consecuencia que hubo que
atender.** La columna es `ON DELETE SET NULL`, así que borrar a un colaborador
vaciaba en silencio la ficha de todos los clientes que lo tuvieran de habitual,
y no quedaba de dónde sacar a quién tenían puesto. Pasaba por dos caminos, y los
dos están cerrados:

- **Al unir dos nombres** en `/revisar`, la referencia se mueve al que se queda
  antes de borrar al absorbido, igual que se mueve el historial de servicios.
  Unir dos fichas de la misma persona no puede perder lo que dice cada una — es
  el mismo fallo que los 40 € del reparto, con un dato de contacto en lugar de
  dinero.
- **Al borrar a un colaborador**, si es el habitual de algún cliente se para y
  se dice de cuántos. Quitarlo de esas fichas es una decisión suya, no un efecto
  lateral de otra cosa.

Y una que se arrastraba desde que se añadió el campo `activo`: la fila de la
tabla de colaboradores se le pasa entera al formulario de edición, pero la
consulta no traía esa columna. La casilla «Activo» salía sin marcar para todo el
mundo, así que **corregir un teléfono desde la tabla daba de baja a la
persona**, sin decir nada. La regla que queda escrita en la consulta: si un
campo se edita en el formulario, tiene que venir en la consulta que alimenta la
fila. Un `undefined` en una casilla es indistinguible de un «no».

## Esquema

`clientes`, `colaboradores`, `servicios` y la tabla de unión
`servicio_colaborador` — un servicio puede llevar varias personas, que es
exactamente lo que la celda apretujada del Excel debería haber sido. Aparte:
`gastos`, `costes_fijos`, `cierres`, `avisos` y `fusiones`.

No hay tabla de usuarios ni de sesiones, y es deliberado: la autenticación no
escribe nada en la base. Ver *Autenticación*.

`clientes.colaborador_id` apunta a quién suele ir. `colaboradores` lleva
`direccion`, `barrio` y `provincia`. Las cuatro columnas se añaden solas sobre
una base que ya tiene datos (`COLUMNAS_NUEVAS` en `scripts/esquema.mjs`), porque
`CREATE TABLE IF NOT EXISTS` no toca una tabla que ya existe.

Cada fila sembrada conserva su `origen` (`CLIENTES AGOSTO 2026!86`), así que
cualquier cifra se puede rastrear hasta una línea concreta de su archivo.

Los importes son `REAL`, no céntimos enteros. Suena mal para contabilidad, pero
él escribe 83,333 € —un tercio de 250— y redondear a céntimos le cambiaría los
totales del año sin avisar. Donde el redondeo sí se nota, el reparto entre
colaboradores, se trabaja en céntimos enteros.

## El respaldo

```bash
TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run respaldo
```

Sólo lee —no hay un `INSERT` ni un `ALTER` en todo el script— y deja un `.sql`
en `.datos/`, fuera de git, que se restaura con `sqlite3 nueva.db < …`. No pisa
uno que ya exista. **Hazlo antes de cualquier `npm run esquema` contra la base
del cliente**: es la única copia que hay.

Una trampa que sólo se ve restaurando: **las columnas generadas no se copian**.
`servicios.margen` lo es, así que un `SELECT *` la trae y el `INSERT` de vuelta
muere con «cannot INSERT into generated column». La primera versión escribía el
respaldo tan tranquila y lo restauraba **sin un solo servicio**. Se detectan con
`pragma_table_xinfo`; `table_info` ni las enseña. Un respaldo que no se ha
restaurado nunca no es un respaldo.

## Notas técnicas

- **SQLite en los dos lados**: Turso (libSQL) en producción y un archivo local
  en desarrollo. Mismo cliente, mismo dialecto, mismas consultas — lo que se
  prueba en local es lo que corre desplegado.
- **`src/proxy.js`, no `middleware.js`.** Next 16 renombró la convención. El
  proxy no decide quién entra: anota la ruta pedida en `x-ruta` —para saber a
  dónde devolverle después de entrar— y refresca la cookie de sesión. Las dos
  cosas hay que hacerlas antes de renderizar, y por eso están ahí y no en otro
  sitio.
- **No puede haber una carpeta `app/` en la raíz**: Next la tomaría como
  directorio de rutas en lugar de `src/app`.
- **Las fechas «de hoy» llevan el huso escrito** (`Europe/Madrid`). Se calculan
  al renderizar en el servidor, y Vercel corre en UTC: con la hora del proceso,
  el día 1 a las 00:30 el formulario proponía la fecha de ayer y el servicio se
  archivaba en el mes anterior, ya cerrado.
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

Las variables ya están en Vercel y las cuatro columnas nuevas ya están en su
base —respaldo del 19 de agosto de 2026 hecho y restaurado antes de tocarla, y
las cifras cuadrando al céntimo después—. Queda:

- Verle entrar la primera vez desde su móvil. La contraseña es la misma que ya
  usaba, así que lo único nuevo para él es la pantalla.
- Enseñarle los dos campos nuevos y confirmar con él el criterio del gasto de
  empresa, que sigue sin confirmar desde la entrega.
- Rellenar los teléfonos de los colaboradores. Sólo 2 de 154 lo tenían, y el
  colaborador habitual del cliente los lee de ahí.
