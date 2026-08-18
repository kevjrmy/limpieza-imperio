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
| Autenticación | Clerk, aún en la cuenta de desarrollo; la puerta la cierra `CORREOS_AUTORIZADOS` |

**Estado:** entregado y en sus manos. Vercel, GitHub, Turso y Clerk son suyos;
en la cuenta de desarrollo no queda nada de lo que dependa la aplicación. Los
datos se migraron y cuadran, y ninguna ruta devuelve nada sin sesión
—comprobado sobre el despliegue real, en el HTML crudo, ruta por ruta.

**Sólo hay una base de datos**, la de su cuenta. La vieja se borró a conciencia
para que nadie la confunda con la buena. El respaldo vive fuera de git, en
`.datos/`, y es lo único que hay si algo sale mal: trátalo como tal.

Lo que queda, y por qué no es trivial: **Clerk es suyo pero sigue en instancia
de desarrollo** (`sk_test_`, `accounts.dev` en la URL de entrada). Pasarlo a
producción exige un dominio propio, porque una instancia de producción necesita
registros DNS y un `*.vercel.app` no los admite. Funciona y es seguro; sólo se
nota en que el login pasa por `accounts.dev` y en los límites de uso.

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
                  FormularioCierre · Filtros · Navegacion · ProveedorClerk
                  AvisoNuevo (confirma un alta y lleva a su fila)
                  formato.js (tono del dinero, fecha de hoy) · rutas.js
                  intentar.js (que un fallo al guardar no se quede mudo)
src/lib/          db.js consultas.js acciones.js sesion.js csv.js esquema.sql
                  recurrencia.js agrupar.js metricas.js texto.js formato.js
                  parser.js
src/proxy.js      Next 16 lo llama proxy; era middleware hasta la 15
scripts/          esquema.mjs · sembrar.mjs · modelo-2026.mjs
                  verificar.mjs · libro-de-prueba.mjs
docs/             archivos reales del cliente (fuera de git)
```

Reparto de responsabilidades:

- **`consultas.js`** lee, **`acciones.js`** escribe. Las dos exigen sesión en
  cada función; ver *Autenticación* más abajo.
- **`db.js`** es lo único que habla con libSQL. Los scripts lo usan directo y
  por eso se saltan la comprobación de sesión, que es lo correcto.
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

**En local NO se ponen las variables `TURSO_`.** `.env.local` va sin ellas a
propósito, para que el desarrollo use `.datos/limpiezas.db` y no haya manera de
tocar los datos del cliente desde aquí. Tampoco lleva claves de Clerk: sin ellas
se pasa sin autenticar y la cabecera lo anuncia con una banda.

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
opcional. Con un `next build && next start` **sin** claves de Clerk, ninguna
ruta puede devolver datos del cliente:

```bash
for u in / /servicios /clientes /clientes/1 /revisar /api/exportar/servicios; do
  curl -s "http://localhost:3000$u" | grep -ci "<un nombre real del libro>"
done   # todos tienen que dar 0
```

Se comprobó y **falló** la primera vez: mirar sólo la página renderizada engaña,
porque los datos viajan además en la carga RSC. Por eso hay que buscar en el
HTML crudo, no en el texto visible.

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

**La sesión se comprueba en cada recurso que toca datos, no en el proxy.** Está
envuelto de forma que no se puede olvidar: toda función exportada de
`consultas.js` y de `acciones.js` pasa por `exigirSesion()`, y la ruta de
descarga la llama a mano.

No es celo: **comprobar sólo en el layout no funciona**. Next renderiza la
página aparte del layout, así que un layout que decide no pintar `children`
igualmente ha ejecutado la página y ha serializado su resultado en la carga RSC.
Se probó y por ahí salían nombres y direcciones en `/servicios`. Es también lo
que recomienda Clerk desde la v7, que por eso marcó `createRouteMatcher` como
obsoleto.

Sin claves de Clerk: en local se pasa sin autenticar y **la cabecera lo anuncia
con una banda**; en producción la aplicación se niega a servirse. No quites
ninguna de las dos cosas.

**La pantalla de entrada NO puede colgar del layout que exige sesión.** Está
fuera del grupo `(panel)` justamente por eso: cuando colgaba del layout raíz y
ese layout pedía sesión, `/entrar` se redirigía a sí misma y la aplicación
quedaba inaccesible en cuanto Clerk tuvo claves de verdad.

El registro de Clerk está abierto, así que quien de verdad cierra la puerta es
`CORREOS_AUTORIZADOS`: una lista separada por comas, y cualquier cuenta que no
esté en ella se rechaza en `exigirSesion()`. Ahora mismo hay dos, la del cliente
y la de desarrollo. **Si la variable se queda vacía, entra cualquiera que se
registre** — no la borres, y si algún día se cierra el registro en el panel de
Clerk, sigue siendo el segundo cerrojo.

**Pégala sin comillas.** Un `.env` guarda el valor entrecomillado; si esas
comillas llegan al panel de Vercel, el primer correo se queda la de apertura y
el último la de cierre, dejan de coincidir con nada y no entra nadie —tampoco
tú—. Pasó al estrenar la instancia de Clerk del cliente y costó un buen rato,
porque el síntoma era un 500 sin explicación. `correosAutorizados` ya las quita,
pero eso es una red, no una excusa.

**`/entrar` tiene salida de emergencia, y hace falta.** Puede darse un bucle
entre dos partes que por separado no hacen nada raro: el navegador cree que
tiene sesión, el servidor no la ve, `exigirSesion()` manda a `/entrar` con
`redirect_url=…`, Clerk ve la sesión del navegador y devuelve a la página, y la
página vuelve a mandar a `/entrar`. Sin parar. Le pasó a él, y no tenía por
dónde salir: el botón de salir vive dentro de `UserButton`, en la cabecera, así
que hay que poder cargar una página para llegar a él —justo lo que el bucle
impide—. Ahora `componentes/Entrada.jsx` mira, **una sola vez al cargar**, si
llegó rebotado (`redirect_url`) teniendo sesión de navegador; si es así no pinta
`<SignIn />` —que es quien devolvería el rebote— sino la explicación y un botón
de salir. Que la decisión se congele no es un detalle: si mirara el estado en
vivo, al entrar con la contraseña la sesión pasaría a activa y le quitaría a
`<SignIn />` el redirigir, que es su trabajo.

Esto **tapa el síntoma, no la causa**. La causa es que Clerk sigue en instancia
de desarrollo: la sesión vive en `accounts.dev`, o sea en un dominio de
terceros, y el traspaso al servidor depende de cookies entre sitios que Safari
en el móvil y las protecciones antiseguimiento cortan. Se arregla pasando a
instancia de producción, que exige dominio propio.

**Una cuenta rechazada va a `/sin-acceso`, no a un error.** Antes se lanzaba una
excepción y Next la convertía en su 500 genérico: la persona veía «A server
error occurred» y no había manera de saber desde el navegador que el problema
era la lista de correos. Esa pantalla cuelga del layout raíz —no de `(panel)`,
por lo mismo que `/entrar`— y lleva botón de salir, porque sin él quien se
equivoca de cuenta se queda dentro, rechazado y sin poder probar con otra.

## Restricciones técnicas

- **`src/proxy.js`, no `middleware.js`.** Next 16 renombró la convención. El
  proxy sólo deja disponible la sesión; no decide quién entra.
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
