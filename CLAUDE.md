# CLAUDE.md

Sistema de contabilidad en línea de Limpiezas El Imperio (La Pobla de Vallbona,
Valencia). **Un solo negocio y un solo usuario**: él entra, lleva sus servicios,
clientes, colaboradores y gastos, y ve el margen real por cliente. `README.md`
explica el porqué de cada decisión; esto es la guía operativa.

| | |
|---|---|
| Repositorio | `limpiezas-el-imperio/limpieza-imperio` (del cliente, el que despliega) y `kevjrmy/limpieza-imperio`. Los dos públicos |
| Producción | https://limpiezas-imperio.vercel.app |
| Proyecto en Vercel | en la cuenta del cliente, Root Directory por defecto |
| Base de datos | Turso (libSQL) en su cuenta — SQLite de verdad, mismo dialecto que en local |
| Autenticación | Propia. Un usuario y una contraseña en variables de entorno; la sesión es una cookie firmada. Sin proveedor externo y sin tablas |

**Estado:** entregado y en sus manos. Vercel, GitHub y Turso son suyos; en la
cuenta de desarrollo no queda nada de lo que dependa la aplicación. Los datos se
migraron y cuadran, y ninguna ruta devuelve nada sin sesión —comprobado sobre el
despliegue real, en el HTML crudo, ruta por ruta.

**Y la está usando.** Entre el respaldo del 17 y el del 19 de agosto de 2026
aplicó una fusión —de ahí que clientes y colaboradores bajen de 140 y 110 a 139
y 109, porque la absorbida se borra— y apuntó un servicio más. Cualquier cifra
de aquí abajo es de cuando se escribió: para saber lo de hoy, mira la base.

**Sólo hay una base de datos**, la de su cuenta. La vieja se borró a conciencia
para que nadie la confunda con la buena. El respaldo vive fuera de git, en
`.datos/`, y es lo único que hay si algo sale mal: trátalo como tal.

**Clerk se quitó en agosto de 2026** y la autenticación se escribió a mano. No
fue por gusto: Clerk resolvía problemas que este negocio no tiene —registro,
invitaciones, roles, recuperación por correo— y a cambio dejaba la sesión en
`accounts.dev`, un dominio de terceros, con lo que el traspaso al servidor
dependía de cookies entre sitios que Safari en el móvil corta. De ahí salía el
bucle de redirecciones que él sufrió. Salir de las llaves de prueba, además,
pedía un dominio propio que no hay. Lo de ahora no necesita ninguna de las dos
cosas. Ver *Autenticación* más abajo.

**No importa su Excel.** Se dejó de leer el `.xlsx` en el navegador: la base
arranca sembrada desde el libro modelo `.ods` y a partir de ahí él edita en la
aplicación. El Excel y los scripts que lo leen siguen existiendo como
herramienta de línea de comandos, no como parte del producto.

## Git

**Se trabaja siempre sobre `main`. No crees ramas nuevas nunca**, ni para
funcionalidades ni para arreglos: commit directo a `main` y push a `origin`.

`origin` tiene una URL de fetch y **dos de push**: el repositorio del cliente y
el propio. Un solo `git push` va a los dos, e imprime **dos bloques de salida
que hay que leer los dos**. Vercel despliega desde el del cliente, así que si
ese falla y el otro no, el push parece haber ido bien y el despliegue se queda
atrás sin decir nada.

Eso depende de que `kevjrmy` siga siendo colaborador en el repositorio del
cliente. **No le quites ese acceso.** Ya se perdió una vez, al cambiar la
visibilidad del repositorio de origen: el permiso venía heredado de la relación
de fork y se evaporó con ella. Ahora es explícito, que es como debe ser.

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

**«Del libro» quiere decir del libro**: sus clientes y sus colaboradores, que
son quienes llevan detrás una dirección, un teléfono y algún DNI. El nombre del
titular no entra en esa regla — dirige una empresa de servicios y su nombre está
en su propia web. Aparece en el historial de git y se queda ahí; no es un
hallazgo ni hay que reescribir nada por él. En el código se le sigue llamando
«él» por costumbre y porque se lee bien, no porque haya que ocultarlo.

Antes de cualquier commit:

```bash
git diff --cached --name-only | grep -Ei '\.(xlsx|xlsm|xls|csv|ods)$|^docs/'
```

Si eso imprime algo, para.

## Estructura

Next.js 16 (App Router) con las rutas en `src/app/`. **No hay carpeta `app/` en
la raíz**: si aparece una, Next la toma como directorio de rutas y deja de ver
`src/app` — pasó al migrar y el síntoma es un 404 en todo o un
`app_dir must be a directory`.

```
src/app/          rutas: / · /preparar · /servicios · /clientes
                  /colaboradores · /gastos · /meses · /revisar · /exportar
                  /entrar
                  api/exportar/[tabla]/route.js
                  api/exportar/mes/[periodo]/route.js
src/componentes/  PanelServicios · FormularioServicio · PanelGastos
                  PanelPreparar · PanelRevisar · FichaPersona · EditarPersona
                  FormularioCierre · Filtros · Navegacion
                  Entrada (el formulario de entrar) · BotonUsuario (salir)
                  AvisoNuevo (confirma un alta y lleva a su fila)
                  formato.js (tono del dinero, fecha de hoy) · rutas.js
                  intentar.js (que un fallo al guardar no se quede mudo)
src/lib/          db.js consultas.js acciones.js csv.js esquema.sql
                  sesion.js (exigirSesion) · acceso.js (entrar y salir)
                  firma.js (la cookie) · clave.js (scrypt)
                  recurrencia.js agrupar.js metricas.js texto.js formato.js
                  parser.js
src/proxy.js      Next 16 lo llama proxy; era middleware hasta la 15
scripts/          esquema.mjs · sembrar.mjs · modelo-2026.mjs
                  verificar.mjs · libro-de-prueba.mjs
                  clave.mjs (credenciales) · respaldo.mjs (copia, sólo lee)
docs/             archivos reales del cliente (fuera de git)
```

Reparto de responsabilidades:

- **`consultas.js`** lee, **`acciones.js`** escribe. Las dos exigen sesión en
  cada función; ver *Autenticación* más abajo.
- **`db.js`** es lo único que habla con libSQL. Los scripts lo usan directo y
  por eso se saltan la comprobación de sesión, que es lo correcto.
- **`firma.js` y `clave.js`** no tocan ni Next ni la base: son `node:crypto` y
  nada más. `firma.js` es lo único de `lib/` que puede importar el proxy.
- **`parser.js`, `agrupar.js`, `metricas.js`** ya no los usa la interfaz: son
  la herramienta que construye el `.ods` y la que demuestra que sigue cuadrando.

## Arrancar en local

```bash
npm install
npm run esquema                        # crea .datos/limpiezas.db
npm run sembrar -- --rehacer           # la llena desde el .ods del modelo
npm run dev                            # http://localhost:3000
```

Sin `TURSO_DATABASE_URL` la base es un archivo local; con ella, Turso. Es el
mismo cliente y el mismo SQL en los dos casos, así que lo que se prueba en local
es lo que corre desplegado.

Las órdenes que hay, y cuáles escriben:

| | |
|---|---|
| `npm run esquema` | **escribe** — crea tablas y añade columnas nuevas |
| `npm run sembrar` | **escribe** — con `--rehacer` borra y vuelve a llenar |
| `npm run modelo` | escribe el `.ods` a partir del `.xlsx` |
| `npm run respaldo` | sólo lee — deja un `.sql` restaurable en `.datos/` |
| `npm run clave` | no toca la base — genera usuario, hash y secreto |
| `npm run verificar` | sólo lee el `.xlsx` |

**En local NO se ponen las variables `TURSO_`.** `.env.local` va sin ellas a
propósito, para que el desarrollo use `.datos/limpiezas.db` y no haya manera de
tocar los datos del cliente desde aquí. Tampoco lleva `USUARIO`, `CLAVE_HASH` ni
`SESION_SECRETO`: sin ellas se pasa sin autenticar y la cabecera lo anuncia con
una banda. Si necesitas probar el login de verdad, pásalas en la propia línea de
órdenes (`USUARIO=… CLAVE_HASH=… SESION_SECRETO=… npx next start`) en vez de
escribirlas en `.env.local`, y así el modo normal de desarrollo sigue sin pedir
contraseña.

El motivo no es teórico. **Los scripts de `scripts/` leen `.env.local` y van a
donde esa variable diga**, así que con Turso configurado un `npm run esquema`
—que suena inofensivo— se ejecuta contra la base de producción, y
`npm run sembrar -- --rehacer` la reescribiría entera. Pasó lo primero; lo
segundo habría sido irreparable. La única base de datos del sistema es la de la
cuenta del cliente: no hay copia de respaldo en otra cuenta esperando a
rescatarte.

## Verificar antes de dar nada por bueno

Si tocas `parser.js`, `agrupar.js` o `metricas.js`, ejecuta:

```bash
node scripts/verificar.mjs "docs/contabilidad limpiezas el imperio 2025-2026.xlsx" --nombres
```

El bloque **LECTURA DEL LIBRO** debe cuadrar exacto: 7 hojas importadas, 14
omitidas, 901 servicios, 75.262,60 € facturados, 67 avisos de año, reparto de
43.244 € con descuadre 0,00 €. Cualquier `FALLA` ahí es una regresión.

El bloque **MÁRGENES DE REFERENCIA** sólo se ejecuta si existe
`scripts/referencia.local.json` con la lista de clientes reales contra la
que contrastar. Ese archivo está fuera de git a propósito (`*.local.json`): si
no está, esa comprobación se omite y las demás siguen corriendo.

El bloque **AGRUPACIÓN** se desvía a propósito de la referencia original
(127 vs 129 clusters de clientes, 103 vs 92 de colaboradores). Está justificado
en el README: no lo "arregles" relajando las salvaguardas sin leer por qué.

Sin el archivo real, `libro-de-prueba.mjs` genera un libro sintético con las
mismas rarezas y nombres inventados.

### Respaldo antes de tocar producción

```bash
TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run respaldo
```

`scripts/respaldo.mjs` **sólo lee** —no hay un INSERT ni un ALTER en todo el
archivo— y deja un `.sql` en `.datos/`, que está fuera de git. Se restaura con
`sqlite3 nueva.db < …`. No pisa un respaldo que ya exista: perder el de ayer por
relanzarlo sería justo el fallo del que protege.

**Ejecútalo antes de cualquier `npm run esquema` que vaya a la base del
cliente.** Es la única copia que hay.

Un detalle que costó encontrarlo y que no se puede deshacer al revés: **las
columnas generadas no se copian**. `servicios.margen` lo es, así que un
`SELECT *` la trae y el INSERT de vuelta muere con «cannot INSERT into generated
column». El respaldo se escribía tan feliz y se restauraba **sin un solo
servicio**; sólo lo cantaba al restaurarlo, o sea el día que ya da igual. Se
detectan con `pragma_table_xinfo` (hidden 2 o 3); `table_info` ni las enseña. Si
algún día se añade otra columna generada, esto ya la respeta — pero **prueba la
restauración**, que es lo único que lo demuestra.

### Comprobar que la base sigue cuadrando

`npm run sembrar` contrasta lo insertado contra el propio `.ods` y **sale con
error si algo no cuadra**: una siembra a medias es peor que ninguna. Deben salir
164 clientes, 154 colaboradores, 996 servicios, 82.865,60 € facturados y el
reparto exactamente igual al pago de los servicios con colaborador asignado.

Después de tocar cualquier cosa que escriba, esta consulta tiene que dar dos
números idénticos — es la que detecta un reparto roto:

```sql
SELECT ROUND((SELECT SUM(pago) FROM servicio_colaborador), 2)                AS repartido,
       ROUND((SELECT SUM(s.pago_colab) FROM servicios s
               WHERE EXISTS (SELECT 1 FROM servicio_colaborador x
                              WHERE x.servicio_id = s.id)), 2)               AS asignado;
```

### Probar que no se escapa nada sin autenticar

Que la página cargue no demuestra nada, y con datos reales dentro esto no es
opcional. Hay dos escenarios y los dos hay que pasarlos.

**Sin las variables de autenticación** —`next build && next start` a secas— la
aplicación no puede servir absolutamente nada:

```bash
for u in / /servicios /clientes /clientes/1 /revisar /api/exportar/servicios; do
  curl -s "http://localhost:3000$u" | grep -ci "<un nombre real del libro>"
done   # todos tienen que dar 0
```

**Con las variables puestas pero sin cookie**, toda ruta tiene que rebotar a
`/entrar` y no soltar nada por el camino:

```bash
for u in / /servicios /clientes /clientes/1 /revisar /api/exportar/servicios; do
  curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3000$u"
  curl -s -L "http://localhost:3000$u"            | grep -ci "<un nombre>"
  curl -s -L -H 'RSC: 1' "http://localhost:3000$u" | grep -ci "<un nombre>"
done   # 307 hacia /entrar, y ceros en las dos búsquedas
```

Se comprobó y **falló** la primera vez: mirar sólo la página renderizada engaña,
porque los datos viajan además en la carga RSC. Por eso se busca en el HTML
crudo y con la cabecera `RSC: 1`, no en el texto visible.

## El libro modelo de 2026

`modelo-2026.mjs` reescribe los meses de 2026 del libro real como base de datos
en `.ods`. **Es la semilla del sistema**: `sembrar.mjs` lo lee y llena las
tablas. El `.xlsx` ya no lo abre nadie salvo este script.

```bash
npm run modelo -- "docs/contabilidad limpiezas el imperio 2025-2026.xlsx"
# → docs/modelo limpiezas el imperio 2026.ods   (fuera de git: lleva datos reales)
npm run sembrar -- --rehacer
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

## Preparar el mes (borradores por recurrencia)

El negocio es rutinario: una persona va a casa de un cliente todos los lunes, y
el mes que viene irá otra vez todos los lunes. `/preparar` mira el mes anterior,
detecta esas rutinas y deja el mes siguiente escrito en **borrador** para que él
sólo corrija lo que haya cambiado.

Cómo se decide qué se repite (`src/lib/recurrencia.js`, módulo puro):

- Se agrupa por **cliente + día de la semana**, y se divide entre las veces que
  ese día cae en el mes. Así un cliente con 13 servicios en viernes sobre 5
  viernes genera 3 por viernes, que es lo que pasa en un edificio con varios
  portales.
- Lo que ocurrió **una sola vez no se copia**: un trabajo suelto no es una
  rutina y proponerlo sólo da filas que borrar.
- El importe, las horas y la hora salen del **valor más repetido**.
- **Quién lo hace se propone sólo si hay una persona claramente habitual.** En
  los datos reales un mismo cliente rota entre tres y cinco personas en un mes
  (hay uno con cinco servicios hechos por cinco personas distintas): rellenarlo
  a ciegas acertaría poco y corregir cuesta más que escribir.

**Un borrador no cuenta para nada** —ni margen, ni cierre, ni exportación—
hasta que él lo confirma. Eso no depende de acordarse de poner un `WHERE`:

- `servicios.borrador` marca la fila.
- **La vista `v_servicios` es lo que cuenta**, y filtra los borradores. Todos los
  agregados leen la vista. La única lectura que va contra la tabla es la lista de
  `/servicios`, que es justo donde hay que verlos.

Si añades una consulta que sume dinero, **lee de `v_servicios`**. Es la misma
idea que la columna generada del margen: la regla vive en el esquema.

Esto no es una precaución teórica: las exportaciones por tabla de
`api/exportar/[tabla]` leían `servicios` a pelo y metían borradores en los CSV
—servicios, clientes, colaboradores y meses— mientras la del mes entero lo hacía
bien. Con un borrador de 999 € en la base, `exportar/servicios` daba 3 filas y
1.299 € facturados donde tocaban 2 y 300 €. Un CSV con facturación inventada se
abre en Excel y ya no recuerda de dónde salió.

Generar se niega si el mes ya tiene servicios confirmados o borradores sin
resolver: adelantar dos veces el mismo mes duplicaría trabajo hecho, y eso no se
arregla deshaciendo.

## Exportar el mes entero

`/api/exportar/mes/2026-08` da **un solo CSV** con servicios, resumen por
cliente, resumen por colaborador, gastos, costes fijos y el cierre, en bloques
uno debajo de otro. Es la maquetación que él ya tenía en Excel —la tabla y,
debajo, los totales—, así que al abrirlo se encuentra algo conocido. Sólo sale
lo confirmado, aquí y en las exportaciones por tabla.

Los CSV de clientes, de colaboradores y de servicios llevan la columna `Nº`, que
es el número de ficha. Es lo que permite cruzar dos exportaciones sin fiarse de
que el nombre esté escrito igual en las dos.

Comprobado abriéndolo con LibreOffice en locale español: los acentos y la raya
llegan bien, y `83,333` se lee como número 83.333, no como texto. Si lo pruebas
con un locale inglés parecerá roto (`10571,579` → 10571579): es el locale de la
prueba, no el archivo.

## Lo recién creado tiene que verse

Las tablas se ordenan **por dinero**, no por antigüedad, y eso esconde lo que
acaba de nacer justo donde él está mirando. Con sus datos reales: un cliente
nuevo tiene margen 0 y **138 de 140 clientes tienen margen positivo**, así que
cae en la fila ~139; un colaborador nuevo no ha cobrado nada y **109 de 110
cobraron algo**, así que queda el último; y un servicio apuntado hoy va detrás
de los **56 que ya tienen fecha posterior** dentro del mismo mes. Si además hay
un filtro de mes o de búsqueda puesto, no sale en absoluto.

Se guardaba bien y no se veía. Él lo reportó como «no funciona», y desde su lado
tenía razón: sin fila a la vista y sin mensaje, guardar y no guardar se parecen
demasiado. **No lo arregles cambiando el orden de las tablas** —`/clientes` va
por margen porque de eso va la pantalla—: se arregla señalando.

Cómo funciona ahora, por si añades otra pantalla que cree algo:

- La acción devuelve `{ ok: true, id }`, y el formulario deja ese id en la URL
  como `?nuevo=<id>` con `useLlevarANuevo()` (`componentes/rutas.js`), sin tocar
  los filtros que ya hubiera. Va por la URL y no por estado de React para que
  sobreviva a un refresco.
- La pantalla lee `nuevo` de `searchParams`, marca esa fila con `data-fila` y
  `fila--nueva`, y `AvisoNuevo` confirma el alta y desplaza la vista hasta ella.
- **Si el filtro deja fuera lo recién creado, hay que decirlo** con el enlace
  para ir a verlo. Callar ahí es volver al problema original.
- El aviso va en gris. El color sigue siendo sólo para el margen y para lo que
  hay que revisar; un «guardado» no es ninguna de las dos cosas.

### Un fallo al guardar no puede quedarse mudo

**Toda llamada a una acción de servidor desde un formulario pasa por
`intentar()` (`componentes/intentar.js`).** Las acciones devuelven `{ error }`
cuando algo no cuadra y eso ya se enseña; el agujero era el otro caso, el de la
llamada que ni siquiera llega a ejecutarse. Ahí la promesa revienta en vez de
devolver nada, y como la llamada vive dentro de un `useTransition` sin `catch`,
el error se lo tragaba la transición: ni fila nueva, ni mensaje, ni nada.
Guardar y no guardar se parecían demasiado — el mismo problema que
`AvisoNuevo`, pero peor, porque esta vez tenía razón: no se había guardado.

Pasa justo el día que se despliega. **Cada despliegue cambia el identificador de
las acciones de servidor**, así que una pestaña abierta desde antes manda el de
un build que ya no existe y el servidor la rechaza; con el móvil, además, basta
con quedarse sin cobertura a media pulsación. Por eso el mensaje dice recargar:
es lo único que arregla los dos casos.

Si añades un formulario, llama a la acción con `intentar(() => accion(...))`, y
pásale el verbo cuando no sea «guardar» (`'borrar'`, `'confirmar el mes'`): el
mensaje tiene que decir qué es lo que no salió.

## Buscar, y distinguir a dos que se llaman igual

Hay caja de búsqueda en `/servicios`, `/clientes` y `/colaboradores`. Las tres
**ignoran los acentos**, y las tres buscan además **por el número de ficha**.

**El plegado de acentos se hace en JavaScript, con `clave()` de `texto.js`** —
la misma función con la que el importador y las propuestas de fusión deciden si
dos nombres son el mismo. Buscar y agrupar entienden lo mismo por «el mismo
nombre», y eso no es casualidad: que se separen sería un error difícil de ver.

**No lo lleves a SQL.** Se intentó plegando con `REPLACE` anidados sobre la
columna: hacen falta 44 y SQLite revienta con `parser stack overflow` a partir
de **29**. El arreglo que apetece —recortar la lista de acentos hasta que quepa—
deja cinco de margen y lo tira la siguiente letra rara, en producción y en las
tres búsquedas a la vez. Si alguna vez hay que hacerlo en la base, es una
columna normalizada con su índice, y una migración.

Se puede filtrar en JS porque son listas cortas: 140 clientes, 110
colaboradores, 996 servicios, y sólo se recorren cuando él escribe algo.

- En `/clientes` y `/colaboradores` se filtra la lista ya traída.
- En `/servicios` **no se puede**: hay paginación, y filtrar después haría que el
  contador dijera un número y la tabla enseñara otro. Allí la búsqueda se
  resuelve antes a una lista de id (`serviciosQueCoinciden`) y el SQL filtra por
  ella. Ojo con el caso vacío: `ids = null` es «no buscó nada» y `ids = []` es
  «buscó y no hay»; sin distinguirlos, una búsqueda sin resultados los devuelve
  todos.

### El número de ficha

Cada cliente y cada colaborador enseña su número —`#047`— en su tabla, en la
ficha, en los desplegables del formulario de servicio y en los CSV. Sirve para
señalar a una persona cuando hay dos que se llaman parecido, que es justo donde
él se atascaba.

- **Sale del `id`, no de `ref`.** `ref` guarda el código del libro modelo
  (`CLI-001`) y **sólo la rellena `sembrar.mjs`**: todo lo dado de alta desde la
  aplicación la tiene a `NULL`. Enseñar `ref` dejaría en blanco justo a la gente
  más reciente. El `id` no falta nunca y ya es lo que va en la URL, así que
  `#047` y `/clientes/47` son el mismo número.
- En el desplegable va **detrás** del nombre. En un `<select>` se salta a una
  opción tecleando sus primeras letras; un prefijo numérico rompe eso.
- Buscar dígitos busca **sólo** por número: `3` da el 3, no los cuarenta que
  llevan un 3 en el nombre. Acepta `47`, `#47` y `047`.
- **Esto no evita duplicados.** Dos fichas de la misma persona tienen dos
  números. Sirve para distinguirlas; unirlas sigue siendo cosa de `/revisar`,
  una a una y decidiéndolo él.

## Quién suele ir a cada cliente

La ficha del cliente lleva un **colaborador habitual**: él lo pidió como «el
nombre del trabajador y su teléfono». Se resolvió con una referencia a
`colaboradores`, no con dos casillas de texto, y las dos mitades de esa decisión
importan.

**El nombre se elige de la lista, no se escribe.** Un nombre escrito a mano
crea una segunda versión de una persona que ya existe, y eso es justo lo que
`/revisar` se pasa el día deshaciendo.

**El teléfono NO se guarda en el cliente**: se lee de la ficha del colaborador y
en el formulario sale como texto, no como campo. Si se pudiera escribir ahí, el
número de una misma persona quedaría copiado en hasta siete fichas de cliente
—ése es el máximo real en sus datos— y el día que cambiara de número no habría
nada que avisara de las otras seis. Es la misma regla que el margen: el dato
vive en un sitio.

**Es opcional, y lo será casi siempre.** En sus datos sólo el 23 % de los
clientes ha tenido siempre a la misma persona; más de la mitad han visto pasar a
tres o más. Por eso no se valida, no se rellena solo y `— sin asignar —` es un
valor legítimo: obligar a ponerlo sería obligar a inventárselo. Es el mismo
motivo por el que `recurrencia.js` no propone colaborador al preparar el mes.

**Cuando la persona elegida no tiene teléfono, se dice.** Sale «sin teléfono» en
ámbar con un enlace a su ficha, porque de sus 154 colaboradores sólo 2 tenían el
número apuntado: al principio esto va a salir casi siempre, y un hueco en blanco
sin explicación se lee como que la aplicación no funciona.

## Dónde vive cada colaborador

La ficha del colaborador lleva **dirección, barrio y provincia**, que él pidió
así. Van en tres campos y no en una sola línea de dirección porque el barrio es
lo que de verdad usa para decidir a quién manda a qué cliente, y dentro de un
texto libre no hay manera de mirarlo de un vistazo.

En la tabla se enseñan en **una sola columna** —«Dónde vive»— con la calle
arriba y `barrio · provincia` debajo: la tabla ya tenía ocho columnas y las tres
se leen como una sola cosa.

**El cliente no tiene barrio ni provincia**, sólo dirección, y es a propósito:
la dirección del cliente ES el sitio al que se va, no dónde vive nadie. Si algún
día hace falta, es la misma migración.

`provincia` es texto libre. Con un solo usuario y casi todo en una provincia no
compensaba una lista cerrada; si algún día conviven «Valencia», «VALENCIA» y
«València» en las exportaciones, ahí está el motivo y el arreglo es una lista.

## Invariantes del dominio

- **El margen es `valor − (pago_colab + transporte)`**, y no se escribe en
  ninguna parte: es una **columna generada** de la tabla `servicios`
  (`esquema.sql`). El criterio vive en un solo sitio y no puede desincronizarse
  de los importes. Si hay que cambiarlo, se cambia ahí y es una migración.

  El gasto de empresa **no entra**. Las columnas `VALOR` y `COMERCIO` del Excel
  no eran el gasto de ese servicio: eran las compras del mes (supermercado,
  ferretería, óptica) apuntadas en la fila donde había hueco, amontonadas en las
  primeras filas de cada hoja sin relación con el cliente de al lado. Ahora viven
  en la tabla `gastos`, por mes, y el resultado mensual sí las descuenta.
  **Pendiente de confirmar con él la primera vez que lo vea.**

  La columna `RENTABILIDAD` del libro no se importó: estaba escrita a mano y no
  seguía el mismo criterio entre hojas.
- **Avisar, nunca corregir en silencio.** Lo que no cuadraba en el Excel está en
  la tabla `avisos`, sin resolver, con la fila de origen. Un número
  silenciosamente arreglado es peor que un número marcado.
- **Agrupar de menos se arregla en pantalla; agrupar de más destruye datos.**
  Las fusiones de nombres están en la tabla `fusiones`, en estado `pendiente`, y
  sólo se aplican cuando él lo dice. Aplicarlas mueve historial y borra filas.

  Esto no es teórico: aceptó las 46 propuestas y una se llevó por delante 40 €.
  Cuando las dos personas ya estaban en el mismo servicio, la fila de la
  absorbida se borraba para no chocar con la clave primaria, y ese pago
  desaparecía. Ahora se **suma** antes de borrar (`aplicarFusion` en
  `acciones.js`). Los márgenes nunca se vieron afectados —`margen` se calcula
  sobre `servicios.pago_colab`, que esto no toca—, pero el reparto por persona
  sí. Lo detectó la consulta de aquí abajo, no una pantalla: si tocas cualquier
  cosa que escriba en `servicio_colaborador`, ejecútala.
- El reparto de pagos se hace en **céntimos enteros** (`repartir()` en
  `metricas.js`) para que la suma de las partes cuadre exacta con el pago.
- **Nada con historial se borra.** Un cliente con servicios o un colaborador con
  asignaciones no se pueden borrar: se marcan inactivos. La comprobación está en
  `acciones.js`, no en la pantalla.
- Los importes son `REAL`, no céntimos enteros: él escribe 83,333 € y redondear
  le cambiaría los totales del año sin avisar.
- Estas dos siguen valiendo para los scripts que leen el Excel: **los campos se
  resuelven por texto de cabecera, nunca por índice**, y **la maquetación se
  detecta por columnas, no por el nombre de la hoja**.

## Autenticación

Un usuario, una contraseña, y nada más. No hay registro, ni invitaciones, ni
roles, ni segundo factor, ni pantalla de perfil, ni recuperación por correo. Se
entra y se sale; eso es todo lo que hace.

**Registrarse no está escondido: no existe.** No hay ruta, no hay acción y no
hay tabla de usuarios donde dar de alta a nadie. Si alguna vez hace falta un
segundo usuario, no se añade una pantalla de alta: se cambia el planteamiento
entero, porque todo esto se apoya en que sólo hay uno.

**La contraseña es la que él ya venía usando con Clerk**, no una nueva. Fue una
decisión suya y es la correcta: cambiarle la contraseña el mismo día que le
cambias la pantalla de entrada es pedirle que aprenda dos cosas a la vez, y
acaba en una llamada. Da la casualidad de que además es fuerte —veinte
caracteres con mayúsculas, minúsculas y dígitos, sin palabra ni año dentro—,
así que la advertencia de más abajo sobre contraseñas memorizables sigue sin
aplicar. Si algún día se cambia, compruébalo antes de darla por buena.

**Tres variables de entorno, y la base de datos no participa.** `USUARIO` es el
nombre de usuario (tiene forma de correo, pero no se le manda ningún correo
nunca), `CLAVE_HASH` es la contraseña pasada por `scrypt` y `SESION_SECRETO`
firma las cookies. Las genera `npm run clave`. **No hay tabla de usuarios ni de
sesiones, y no las añadas sin pensarlo dos veces**: que la autenticación no
pueda escribir en la base es lo que garantiza que un fallo aquí te deje fuera
pero no te corrompa la contabilidad, que es la única copia que existe.

**La sesión se comprueba en cada recurso que toca datos, no en el proxy.** Está
envuelto de forma que no se puede olvidar: toda función exportada de
`consultas.js` y de `acciones.js` pasa por `exigirSesion()`, y la ruta de
descarga la llama a mano.

No es celo: **comprobar sólo en el layout no funciona**. Next renderiza la
página aparte del layout, así que un layout que decide no pintar `children`
igualmente ha ejecutado la página y ha serializado su resultado en la carga RSC.
Se probó y por ahí salían nombres y direcciones en `/servicios`. La única
barrera que no se puede esquivar es la que está pegada a los datos.

Sin las tres variables: en local se pasa sin autenticar y **la cabecera lo
anuncia con una banda**; en producción la aplicación se niega a servirse. No
quites ninguna de las dos cosas.

**Pégalas sin comillas.** Un `.env` guarda el valor entrecomillado; si esas
comillas llegan al panel de Vercel se quedan dentro del valor, deja de coincidir
con nada y no entra nadie —tampoco tú—. Pasó con `CORREOS_AUTORIZADOS` en
tiempos de Clerk y costó un buen rato, porque el síntoma era un 500 sin
explicación. Aquí no hay red que lo recoja: el hash con una comilla pegada
simplemente no es el hash.

### Cómo está montado

- **`lib/firma.js`** firma y comprueba la cookie. Es puro `node:crypto` y es el
  **único módulo de `lib/` que puede importar el proxy** — si algún día crece
  hacia otras dependencias, esa importación es lo primero que hay que revisar.
- **`lib/clave.js`** hashea con `scrypt`, que viene en Node. Nada de bcrypt ni
  argon2: son paquetes nativos, y uno que un día deja de compilar en el runtime
  de Vercel es un despliegue roto por algo ajeno a la contabilidad.
- **`lib/acceso.js`** tiene las dos acciones, `entrar` y `salir`. Va aparte de
  `acciones.js` por lo evidente: allí todo pasa por `exigirSesion()`, y entrar
  es justo lo que no puede exigir sesión.
- **`lib/sesion.js`** es `exigirSesion()` y poco más.
- **El proxy** anota la ruta pedida en `x-ruta` —de ahí sale el `?volver=` para
  devolverle a donde iba— y vuelve a firmar la cookie cuando lleva más de un día
  emitida. Las dos cosas sólo se pueden hacer antes de renderizar: una cookie no
  se puede escribir durante el render, y un componente de servidor no sabe su
  propia URL.

**La clave de firma se deriva de las tres variables juntas**, no es
`SESION_SECRETO` a secas. Consecuencia buscada: cambiar cualquiera de ellas en
Vercel invalida en el acto todas las cookies emitidas. **Es el botón de
emergencia** —si él pierde el móvil, se cambia `SESION_SECRETO`— y de paso hace
que cambiar la contraseña cierre las sesiones abiertas sin que haya que
acordarse de nada. No es la única forma de cerrar sesiones: es la única.

**Treinta días deslizantes.** Usándola a diario no vuelve a ver la pantalla de
entrada; caduca tras un mes sin abrirla.

**El `Secure` de la cookie sale del protocolo de la petición, no de
`NODE_ENV`.** En Vercel siempre llega `x-forwarded-proto: https`. Pero un
`next build && next start` en local va por http, y con `Secure` puesto el
navegador tira la cookie sin decir ni pío: se ve como «entro y me devuelve otra
vez a entrar», que es de lo más desagradable de diagnosticar. Con `NODE_ENV` de
respaldo pasaría exactamente eso, porque `next start` en local ya es producción.

**La pantalla de entrada NO puede colgar del layout que exige sesión.** Está
fuera del grupo `(panel)` justamente por eso: cuando colgaba del layout raíz y
ese layout pedía sesión, `/entrar` se redirigía a sí misma y la aplicación
quedaba inaccesible.

**El bucle de redirecciones ya no puede darse, y por eso se borró su parche.**
Aquello era: el navegador creía tener sesión, el servidor no la veía, y se
mandaban el uno al otro sin parar. Existía porque la sesión de Clerk vivía en
`accounts.dev` y el traspaso al servidor dependía de cookies entre sitios que
Safari en el móvil corta — dos partes que podían discrepar. Ahora la cookie es
de este mismo dominio y hay una sola fuente de verdad: si el servidor no
reconoce la sesión, es que no la hay. **Si algún día vuelve a aparecer un bucle
entre `/entrar` y el panel, no lo tapes en `Entrada.jsx`**: significa que hay dos
sitios decidiendo lo mismo, y el error está en el segundo.

Por lo mismo desapareció `/sin-acceso`: ya no existe «cuenta identificada pero
sin permiso». O las credenciales coinciden o no coinciden.

### Lo que esto no hace, dicho en voz alta

- **No se puede cerrar una sesión concreta.** Se cierran todas o ninguna.
- **No hay recuperación.** Si se pierde la contraseña se genera otra con
  `npm run clave` y se cambia en Vercel. De un hash no sale la contraseña.
- **El freno a la fuerza bruta se cuenta en memoria del proceso**, así que frena
  a quien pruebe en serie y no a quien reparta los intentos entre instancias.
  Nada de esto sostiene la seguridad del sistema: la sostiene una contraseña de
  veinticuatro caracteres aleatorios, unos 139 bits. **Si alguna vez se cambia
  por una que él pueda recordar, esa cuenta deja de valer** y entonces sí hace
  falta un freno de verdad.

## Restricciones técnicas

- **`src/proxy.js`, no `middleware.js`.** Next 16 renombró la convención. El
  proxy no decide quién entra: anota la ruta en `x-ruta` y refresca la cookie.
  Puede importar `lib/firma.js` —y sólo eso— porque desde Next 16 corre en Node;
  con Clerk no podía importar nada de `lib/`, que es de donde viene la regla
  vieja.
- **No crees una carpeta `app/` en la raíz.** Next la tomaría como directorio de
  rutas en lugar de `src/app`.
- **`db.js` es lo único que abre la base.** El cliente se crea perezoso y sin
  `Proxy` de por medio: Next evalúa el módulo en tiempo de compilación y crearlo
  arriba revienta el build cuando aún no hay variables de entorno.
- **Nada de fechas «de hoy» sacadas de la hora del proceso.** Vercel corre en
  UTC y el navegador está en Madrid, así que entre las 00:00 y las 02:00 no
  coinciden. `fechaDeHoy()` lleva `Europe/Madrid` escrito. Con la hora del
  proceso, el día 1 a las 00:30 el servidor proponía la fecha de ayer y —como el
  mes contable sale de la fecha— el servicio se archivaba en el mes pasado, ya
  cerrado. Si necesitas otra fecha por defecto, sale de ahí.
- **`consultas.js` no puede importarse desde un componente de cliente**: arrastra
  `sesion.js`, que es sólo de servidor. Lo compartido (`nombrePeriodo`, formato
  de euros y fechas) vive en `formato.js`, que es puro.
- **`vercel.json` sólo tiene `"framework": "nextjs"`, y hace falta.** El proyecto
  se creó como Vite y esa preferencia sigue guardada en Vercel; sin esta clave el
  build termina bien pero el despliegue falla buscando una carpeta `dist` que ya
  no existe. No le añadas comandos: se validan contra un esquema que rechaza
  claves desconocidas, y los `buildCommand` con rutas relativas fueron la causa
  de varios despliegues rotos (b21d1cd, 9c0b0df). Ya no hacen falta las cabeceras
  COOP/COEP — no hay OPFS.
- **`next.config.mjs` lleva `deploymentId`, y hace falta.** Sale de
  `VERCEL_DEPLOYMENT_ID` (con el sha del commit de reserva), así que cambia solo
  en cada despliegue. Con él, Next cuelga `?dpl=…` de cada archivo estático —el
  navegador no puede reutilizar el de ayer— y compara la marca del cliente con
  la suya en cada navegación: si no coinciden, recarga la página entera en vez
  de seguir ejecutando código viejo. Sin eso, la pestaña que él deja abierta
  días manda identificadores de acciones de un build que ya no existe y guardar
  falla; ver *Un fallo al guardar no puede quedarse mudo*. En local las dos
  variables están vacías y queda `undefined`, que es lo de siempre.
- **Comprueba siempre que el despliegue quedó en `Ready`.** Si falla, Vercel
  sigue sirviendo el anterior tan ricamente, y la URL responde 200 como si nada.

  `vercel ls limpieza-imperio` **ya no sirve**: contesta `project_not_found`
  porque el proyecto vive en la cuenta del cliente y el CLI de aquí no la
  alcanza. Sus registros de ejecución tampoco. Lo que sí se ve es el commit
  status que Vercel publica en su repositorio, que es público:

  ```bash
  gh api repos/limpiezas-el-imperio/limpieza-imperio/commits/<sha>/status \
    --jq '.statuses[] | "\(.context): \(.state) — \(.description)"'
  ```

  Sondéalo hasta que `.state` deje de ser `pending`; tarda del orden de medio
  minuto.
- **Después de reconstruir, asegúrate de que el build terminó antes de arrancar
  `next start`.** Un `next start` sobre un `.next` viejo sirve código anterior sin
  decir nada; costó dos diagnósticos falsos, uno de ellos de seguridad.
- SheetJS se instala desde el CDN oficial y **sólo es dependencia de desarrollo**:
  lo usan los scripts, no la aplicación. El paquete `xlsx` de npm está abandonado
  en la 0.18.5 — no lo "actualices" a él.

## Estilo

- **CSS plano en `src/estilos.css`. Nada de Tailwind ni SASS.**
- Estética de libro de cuentas: reglas finas, `tabular-nums`, dinero
  monoespaciado y a la derecha. **Color sólo para dos cosas: el margen y lo que
  hay que revisar.** No añadas colores decorativos.
- En las tablas, las reglas de estructura van con `:where()` para no ganarle en
  especificidad a las utilidades (`.num`, `.dinero`). Ya rompió la alineación
  una vez.
- **Toda la interfaz y todo el código —nombres, comentarios, commits— en
  español.**
- Responsive hasta móvil, foco visible y `prefers-reduced-motion` respetado.
- Se edita donde se lee: los formularios se abren en la propia fila de la tabla,
  no en otra página. Él viene de desplazarse por una hoja de 224 filas.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
