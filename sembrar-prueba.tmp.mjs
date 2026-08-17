// Datos inventados para probar la búsqueda de /servicios en el navegador.
// Temporal: se borra al terminar. Nombres del juego de ejemplo de siempre.
import { db } from './src/lib/db.js';

const CLIENTES = ['ELENA P', 'ELENA PRADOS', 'ELENA MOLINA', 'BEATRIZ SOLANO',
  'MARIANO', 'MARIANA'];
const COLABS = ['LUCIA', 'TOMAS RIVAS', 'NURIA'];

for (const n of CLIENTES) {
  await db().execute({
    sql: `INSERT INTO clientes (nombre, direccion, telefono)
          VALUES (?, 'CALLE MAYOR 1', '600 000 000')`, args: [n] });
}
for (const n of COLABS) {
  await db().execute({ sql: 'INSERT INTO colaboradores (nombre) VALUES (?)', args: [n] });
}

// Un servicio por cliente y día, repartido entre los colaboradores.
let dia = 3;
for (let c = 1; c <= CLIENTES.length; c++) {
  for (let i = 0; i < 3; i++) {
    const fecha = `2026-08-${String(dia++ % 28 + 1).padStart(2, '0')}`;
    const notas = i === 2 ? 'cambio de cerradura' : '';
    const borrador = i === 2 && c === 1 ? 1 : 0;
    const { lastInsertRowid: id } = await db().execute({
      sql: `INSERT INTO servicios
              (periodo, fecha, hora, cliente_id, horas, valor, pago_colab,
               transporte, notas, revisar, borrador)
            VALUES ('2026-08', ?, '09:00', ?, 2, 120, 60, 5, ?, 0, ?)`,
      args: [fecha, c, notas, borrador] });
    const colab = ((c + i) % COLABS.length) + 1;
    await db().execute({
      sql: `INSERT INTO servicio_colaborador (servicio_id, colaborador_id, pago)
            VALUES (?, ?, 60)`, args: [id, colab] });
  }
}

const { rows } = await db().execute(
  'SELECT (SELECT COUNT(*) FROM servicios) AS s, (SELECT COUNT(*) FROM v_servicios) AS v');
console.log(rows[0]);
