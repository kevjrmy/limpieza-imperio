-- Esquema de Limpiezas El Imperio.
--
-- Sale del libro modelo de 2026 (docs/modelo … .ods), que a su vez sale del
-- libro real. Cada tabla del modelo es una tabla aquí.
--
-- Dos decisiones que conviene conocer antes de tocar nada:
--
--  · El margen NO se guarda: es una columna generada a partir de las que lo
--    componen. Así el criterio vive en un solo sitio y no puede quedarse
--    desfasado respecto a los importes, que es exactamente lo que le pasa a la
--    columna RENTABILIDAD escrita a mano en el Excel.
--
--  · Los importes son REAL, no céntimos enteros. Suena mal para contabilidad,
--    pero él escribe 83,333 € (un tercio de 250) y redondear a céntimos le
--    cambiaría los totales del año sin avisar. El reparto entre colaboradores
--    sí se hace en céntimos enteros, que es donde el redondeo se nota.

PRAGMA foreign_keys = ON;

-- ── Clientes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ref         TEXT UNIQUE,             -- id del modelo (CLI-001), para trazar
  nombre      TEXT NOT NULL,
  direccion   TEXT NOT NULL DEFAULT '',
  telefono    TEXT NOT NULL DEFAULT '',
  notas       TEXT NOT NULL DEFAULT '',
  activo      INTEGER NOT NULL DEFAULT 1,

  -- Quién suele ir a este cliente. Es una REFERENCIA, no un nombre escrito a
  -- mano, y el teléfono NO se copia aquí: se lee de la ficha de esa persona.
  -- Si se copiara, el mismo número quedaría escrito en hasta siete fichas de
  -- cliente y el día que cambie de número habría que acordarse de las siete.
  --
  -- Es opcional a propósito. En sus datos sólo el 23 % de los clientes ha
  -- tenido siempre a la misma persona: más de la mitad han visto pasar a tres
  -- o más. Obligar a rellenarlo sería obligar a inventarse un dato.
  colaborador_id INTEGER REFERENCES colaboradores(id) ON DELETE SET NULL,

  creado_en   TEXT NOT NULL DEFAULT (datetime('now')),
  editado_en  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_colaborador ON clientes(colaborador_id);

-- ── Colaboradores ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS colaboradores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ref         TEXT UNIQUE,
  nombre      TEXT NOT NULL,
  telefono    TEXT NOT NULL DEFAULT '',
  notas       TEXT NOT NULL DEFAULT '',
  activo      INTEGER NOT NULL DEFAULT 1,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now')),
  editado_en  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_colaboradores_nombre ON colaboradores(nombre);

-- ── Servicios ───────────────────────────────────────────────────────────────
-- `periodo` es el mes contable ('2026-08') y manda sobre `fecha`: en el libro
-- original hay fechas que contradicen a su propia hoja. `fecha` se guarda tal
-- y como se escribió y se marca `revisar` cuando las dos no coinciden.
CREATE TABLE IF NOT EXISTS servicios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ref         TEXT UNIQUE,
  periodo     TEXT NOT NULL,
  fecha       TEXT NOT NULL DEFAULT '',
  hora        TEXT NOT NULL DEFAULT '',
  cliente_id  INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  horas       REAL NOT NULL DEFAULT 0,
  personas    INTEGER,
  valor       REAL NOT NULL DEFAULT 0,
  pago_colab  REAL NOT NULL DEFAULT 0,
  transporte  REAL NOT NULL DEFAULT 0,
  pagado      INTEGER NOT NULL DEFAULT 0,
  notas       TEXT NOT NULL DEFAULT '',
  revisar     INTEGER NOT NULL DEFAULT 0,
  origen      TEXT NOT NULL DEFAULT '',   -- 'CLIENTES AGOSTO 2026!86' o '' si es nuevo

  -- Un borrador es un servicio propuesto por el generador de recurrencias que
  -- él todavía no ha validado. NO cuenta para nada hasta que lo confirma: los
  -- agregados leen la vista `v_servicios`, no esta tabla.
  borrador    INTEGER NOT NULL DEFAULT 0,

  creado_en   TEXT NOT NULL DEFAULT (datetime('now')),
  editado_en  TEXT NOT NULL DEFAULT (datetime('now')),

  -- El criterio de la casa, escrito una sola vez y en el sitio donde no puede
  -- desincronizarse de los importes.
  margen      REAL GENERATED ALWAYS AS (valor - pago_colab - transporte) VIRTUAL
);
CREATE INDEX IF NOT EXISTS idx_servicios_periodo ON servicios(periodo);
CREATE INDEX IF NOT EXISTS idx_servicios_cliente ON servicios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_servicios_fecha   ON servicios(fecha);
CREATE INDEX IF NOT EXISTS idx_servicios_revisar ON servicios(revisar);
CREATE INDEX IF NOT EXISTS idx_servicios_borrador ON servicios(borrador);

-- Los servicios que cuentan.
--
-- Todo lo que suma dinero —resúmenes, márgenes por cliente, cierres de mes,
-- exportaciones— lee de aquí y NUNCA de `servicios` a pelo. Es la misma idea
-- que la columna generada del margen: la regla vive en el esquema, en un solo
-- sitio, en vez de repartida por veinte consultas donde basta olvidarse de un
-- WHERE para inflarle la facturación con servicios que él no ha confirmado.
--
-- La pantalla de servicios sí lee la tabla directamente: es donde revisa los
-- borradores, y ahí tienen que verse.
CREATE VIEW IF NOT EXISTS v_servicios AS
  SELECT * FROM servicios WHERE borrador = 0;

-- ── Quién hizo cada servicio ────────────────────────────────────────────────
-- `pago` es la parte que le tocó a esa persona en ese servicio. Se reparte en
-- céntimos enteros para que la suma de las partes sea idéntica al pago_colab.
CREATE TABLE IF NOT EXISTS servicio_colaborador (
  servicio_id     INTEGER NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  colaborador_id  INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
  pago            REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (servicio_id, colaborador_id)
);
CREATE INDEX IF NOT EXISTS idx_sc_colaborador ON servicio_colaborador(colaborador_id);

-- ── Gastos de empresa ───────────────────────────────────────────────────────
-- Compras del mes. En el Excel vivían dentro de las filas de servicio, lo que
-- le cargaba el gasto al cliente que hubiera al lado. Aquí van aparte.
CREATE TABLE IF NOT EXISTS gastos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ref         TEXT UNIQUE,
  periodo     TEXT NOT NULL,
  fecha       TEXT NOT NULL DEFAULT '',
  comercio    TEXT NOT NULL DEFAULT '',
  concepto    TEXT NOT NULL DEFAULT '',
  importe     REAL NOT NULL DEFAULT 0,
  origen      TEXT NOT NULL DEFAULT '',
  creado_en   TEXT NOT NULL DEFAULT (datetime('now')),
  editado_en  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gastos_periodo ON gastos(periodo);

-- ── Costes fijos ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS costes_fijos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ref         TEXT UNIQUE,
  periodo     TEXT NOT NULL,
  concepto    TEXT NOT NULL,
  importe     REAL NOT NULL DEFAULT 0,
  origen      TEXT NOT NULL DEFAULT '',
  creado_en   TEXT NOT NULL DEFAULT (datetime('now')),
  editado_en  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_costes_periodo ON costes_fijos(periodo);

-- ── Cierre de cada mes ──────────────────────────────────────────────────────
-- Lo que él ya apuntaba a mano bajo la tabla: seguridad social, gestoría,
-- retenciones. `facturado_libro` guarda lo que decía su Excel, para poder
-- seguir enseñando la diferencia.
CREATE TABLE IF NOT EXISTS cierres (
  periodo          TEXT PRIMARY KEY,
  seg_soc          REAL NOT NULL DEFAULT 0,
  gestoria         REAL NOT NULL DEFAULT 0,
  iva_irpf         REAL NOT NULL DEFAULT 0,
  facturado_libro  REAL,
  resultado_libro  REAL,
  notas            TEXT NOT NULL DEFAULT '',
  editado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Avisos de la importación ────────────────────────────────────────────────
-- Lo que no cuadraba en el Excel. No se corrigió nada en silencio: se trae para
-- que él lo vaya resolviendo desde la aplicación.
CREATE TABLE IF NOT EXISTS avisos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ref         TEXT UNIQUE,
  tipo        TEXT NOT NULL,
  periodo     TEXT NOT NULL DEFAULT '',
  origen      TEXT NOT NULL DEFAULT '',
  detalle     TEXT NOT NULL,
  resuelto    INTEGER NOT NULL DEFAULT 0,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_avisos_resuelto ON avisos(resuelto);

-- ── Fusiones de nombres pendientes de decidir ───────────────────────────────
-- Nombres que podrían ser la misma persona. Nada se aplica sin que él lo
-- confirme: agrupar de menos se arregla en pantalla, agrupar de más destruye
-- datos.
CREATE TABLE IF NOT EXISTS fusiones (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ref         TEXT UNIQUE,
  tabla       TEXT NOT NULL,             -- 'clientes' | 'colaboradores'
  confianza   TEXT NOT NULL,             -- 'alta' | 'baja'
  motivo      TEXT NOT NULL DEFAULT '',
  quedaria    TEXT NOT NULL,
  absorberia  TEXT NOT NULL,
  usos        INTEGER NOT NULL DEFAULT 0,
  ojo         TEXT NOT NULL DEFAULT '',
  estado      TEXT NOT NULL DEFAULT 'pendiente',  -- pendiente | aceptada | rechazada
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);
