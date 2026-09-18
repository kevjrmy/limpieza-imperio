'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { guardarDocumento } from '../lib/acciones.js';
import {
  TIPOS, IMPORTES_HOJA, calcular, clienteDesdeFicha, nuevaLinea, nuevaTarea,
} from '../lib/documentos.js';
import { euros, numero as cifra, codigo } from '../lib/formato.js';
import { intentar } from './intentar.js';

/**
 * Rellenar una hoja de servicio o una cuenta de cobro.
 *
 * Sirve para las tres cosas: una en blanco, editar una guardada, y «nueva a
 * partir de esta». Las dos que crean se distinguen de editar sólo en que no
 * llevan `id`; la copia llega ya rellena en `inicial`, y al guardar se crea
 * otra fila —la de origen no se toca—. Es lo que pidió: poder sacar otra sin
 * modificar la anterior.
 *
 * El documento entero vive en estado y se manda como un objeto, no como
 * FormData: tiene listas de filas que se añaden y se quitan, y aplanarlas en
 * nombres de campo sería reinventar mal un JSON.
 */
export default function FormularioDocumento({
  tipo, id = null, numero: numeroInicial, clienteId: clienteInicial = null, inicial,
  clientes = [], colaboradores = [], origen = null, alTerminar, alGuardar,
}) {
  const router = useRouter();
  const t = TIPOS[tipo];
  const [numero, setNumero] = useState(String(numeroInicial ?? ''));
  const [clienteId, setClienteId] = useState(clienteInicial ? String(clienteInicial) : '');
  const [d, setD] = useState(inicial);
  const [enviando, empezar] = useTransition();
  const [error, setError] = useState(null);

  const poner = (campo, valor) => setD((x) => ({ ...x, [campo]: valor }));
  const ponerCliente = (campo, valor) => setD((x) => ({ ...x, cliente: { ...x.cliente, [campo]: valor } }));

  function elegirCliente(valor) {
    setClienteId(valor);
    const ficha = clientes.find((c) => String(c.id) === valor);
    // Elegir de la lista copia sus datos al papel. Se pueden retocar después:
    // lo que se guarda es esta copia, no la ficha.
    if (ficha) setD((x) => ({ ...x, cliente: { ...clienteDesdeFicha(ficha), localidad: x.cliente.localidad } }));
  }

  function enviar(evento) {
    evento.preventDefault();
    setError(null);
    empezar(async () => {
      const r = await intentar(() => guardarDocumento(tipo, id, { numero, clienteId, contenido: d }));
      if (r?.error) { setError(r.error); return; }

      if (id) {
        alGuardar?.(r);
        // Sin `?guardado=…`: el aviso de «guardada como» era del alta, y
        // seguía saliendo después de cada edición.
        router.replace(`${t.ruta}/${id}`);
        alTerminar?.();
        return;
      }
      // Lo recién creado se abre directamente: así se ve que existe, con su
      // número, y que el de origen sigue siendo otro.
      const q = new URLSearchParams({ guardado: '1' });
      if (origen) q.set('desde', String(origen));
      router.push(`${t.ruta}/${r.id}?${q}`);
    });
  }

  const titulo = id ? `Editar ${t.articulo} ${codigo(numeroInicial)}`
    : origen ? `Nueva a partir de ${t.articulo} ${codigo(origen)}`
      : `Nueva ${t.nombre.toLowerCase()}`;

  return (
    <form className="formulario formulario--documento" onSubmit={enviar}>
      <h2 className="formulario__titulo campo--ancho">{titulo}</h2>
      {origen && (
        <p className="campo__ayuda campo--ancho">
          Es una copia: al guardar se crea {t.articulo} {codigo(numero)} y{' '}
          {t.articulo} {codigo(origen)} sigue como estaba.
        </p>
      )}
      {error && <p className="alerta alerta--error campo--ancho">{error}</p>}

      <label className="campo">
        <span>Número</span>
        <input type="text" inputMode="numeric" required value={numero}
          onChange={(e) => setNumero(e.target.value)} />
      </label>

      <label className="campo">
        <span>Fecha</span>
        <input type="date" required value={d.fecha} onChange={(e) => poner('fecha', e.target.value)} />
      </label>

      {tipo === 'hoja' ? (
        <>
          <label className="campo">
            <span>Hora</span>
            <input type="time" value={d.hora} onChange={(e) => poner('hora', e.target.value)} />
          </label>
          <label className="campo">
            <span>Tipo de limpieza</span>
            <input type="text" value={d.tipoLimpieza} placeholder="Limpieza profunda…"
              onChange={(e) => poner('tipoLimpieza', e.target.value)} />
          </label>
        </>
      ) : (
        <>
          <label className="campo">
            <span>Ciudad</span>
            <input type="text" value={d.ciudad} onChange={(e) => poner('ciudad', e.target.value)} />
          </label>
          <label className="campo">
            <span>Concepto</span>
            <input type="text" value={d.concepto} placeholder="Limpieza a fondo vivienda…"
              onChange={(e) => poner('concepto', e.target.value)} />
          </label>
        </>
      )}

      <Cliente d={d} clientes={clientes} clienteId={clienteId}
        elegir={elegirCliente} poner={ponerCliente} />

      {tipo === 'hoja'
        ? <Hoja d={d} setD={setD} poner={poner} colaboradores={colaboradores} />
        : <Cobro d={d} setD={setD} poner={poner} />}

      <label className="campo campo--ancho">
        <span>Observaciones</span>
        <textarea value={d.observaciones} onChange={(e) => poner('observaciones', e.target.value)} />
      </label>

      <div className="formulario__acciones">
        <button type="submit" className="boton boton--principal" disabled={enviando}>
          {enviando ? 'Guardando…' : id ? 'Guardar cambios' : `Guardar ${t.articulo}`}
        </button>
        <button type="button" className="boton boton--plano" disabled={enviando} onClick={alTerminar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ── El cliente ──────────────────────────────────────────────────────────────

function Cliente({ d, clientes, clienteId, elegir, poner }) {
  const c = d.cliente;
  return (
    <fieldset className="grupo campo--ancho">
      <legend>Datos del cliente</legend>

      {/* La etiqueta va con `htmlFor` y no envolviendo: si envolviera, la ayuda
          de debajo formaría parte del nombre del campo al leerlo en voz alta. */}
      <div className="campo campo--ancho">
        <span><label htmlFor="documento-cliente">Cliente</label></span>
        <select id="documento-cliente" value={clienteId} onChange={(e) => elegir(e.target.value)}>
          <option value="">— escrito a mano, sin ficha —</option>
          {clientes.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre} {codigo(f.id)}{f.activo ? '' : ' · inactivo'}
            </option>
          ))}
        </select>
        <span className="campo__ayuda">
          Al elegirlo se copian los datos de su ficha, DNI incluido. Lo que cambies aquí
          se queda en este papel y no toca la ficha.
        </span>
      </div>

      <label className="campo">
        <span>Nombre y apellidos</span>
        <input type="text" required value={c.nombre} onChange={(e) => poner('nombre', e.target.value)} />
      </label>
      <label className="campo">
        <span>DNI / NIF</span>
        <input type="text" value={c.nif} onChange={(e) => poner('nif', e.target.value)} />
      </label>
      <label className="campo">
        <span>Teléfono</span>
        <input type="tel" value={c.telefono} onChange={(e) => poner('telefono', e.target.value)} />
      </label>
      <label className="campo">
        <span>Dirección</span>
        <input type="text" value={c.direccion} onChange={(e) => poner('direccion', e.target.value)} />
      </label>
      <label className="campo">
        <span>Localidad</span>
        <input type="text" value={c.localidad} onChange={(e) => poner('localidad', e.target.value)} />
      </label>
      <label className="campo">
        <span>Código postal</span>
        <input type="text" inputMode="numeric" maxLength={5} value={c.codigoPostal}
          onChange={(e) => poner('codigoPostal', e.target.value)} />
      </label>
    </fieldset>
  );
}

// ── Hoja de servicio ────────────────────────────────────────────────────────

function Hoja({ d, setD, poner, colaboradores }) {
  const totales = calcular('hoja', d);
  const tareas = d.tareas;

  const ponerTarea = (i, campo, valor) => setD((x) => ({
    ...x, tareas: x.tareas.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)),
  }));
  const quitarTarea = (i) => setD((x) => ({ ...x, tareas: x.tareas.filter((_, j) => j !== i) }));
  const añadirTarea = () => setD((x) => ({ ...x, tareas: [...x.tareas, nuevaTarea()] }));

  // El personal se elige de la lista de colaboradores y se guarda por nombre:
  // en el papel va el nombre, y escribirlo a mano crearía otra versión de
  // alguien que ya existe.
  const añadirPersona = (nombre) => {
    if (!nombre) return;
    setD((x) => (x.personal.includes(nombre) ? x : { ...x, personal: [...x.personal, nombre] }));
  };
  const quitarPersona = (nombre) => setD((x) => ({ ...x, personal: x.personal.filter((p) => p !== nombre) }));

  return (
    <>
      <fieldset className="grupo campo--ancho">
        <legend>Descripción del servicio</legend>
        <div className="tabla-envoltorio campo--ancho">
          <table className="tabla tabla--edicion">
            <thead>
              <tr>
                <th scope="col">Descripción</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Observaciones</th>
                <th scope="col">Hecha</th>
                <th scope="col">Responsable</th>
                <th scope="col"><span className="visualmente-oculto">Quitar</span></th>
              </tr>
            </thead>
            <tbody>
              {tareas.map((f, i) => (
                <tr key={i}>
                  <td><input type="text" aria-label="Descripción" value={f.descripcion}
                    onChange={(e) => ponerTarea(i, 'descripcion', e.target.value)} /></td>
                  <td className="tabla--edicion__corta">
                    <input type="text" aria-label="Cantidad" value={f.cantidad} placeholder="2, varios…"
                      onChange={(e) => ponerTarea(i, 'cantidad', e.target.value)} /></td>
                  <td><input type="text" aria-label="Observaciones" value={f.observaciones}
                    onChange={(e) => ponerTarea(i, 'observaciones', e.target.value)} /></td>
                  <td className="tabla--edicion__casilla">
                    <input type="checkbox" aria-label="Realizada" checked={f.realizada}
                      onChange={(e) => ponerTarea(i, 'realizada', e.target.checked)} /></td>
                  <td>
                    <select aria-label="Responsable" value={f.responsable}
                      onChange={(e) => ponerTarea(i, 'responsable', e.target.value)}>
                      <option value="">—</option>
                      {/* La que tuviera puesta sigue saliendo aunque ya no esté
                          en el personal: si no, el select la borraría sin avisar. */}
                      {[...new Set([...d.personal, f.responsable].filter(Boolean))].map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button type="button" className="boton boton--plano" onClick={() => quitarTarea(i)}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grupo__pie">
          <button type="button" className="boton" onClick={añadirTarea}>Añadir fila</button>
          <span className="campo__ayuda">El responsable se elige entre el personal asignado.</span>
        </div>
      </fieldset>

      <fieldset className="grupo campo--ancho">
        <legend>Personal asignado</legend>
        <label className="campo">
          <span>Añadir persona</span>
          <select value="" onChange={(e) => añadirPersona(e.target.value)}>
            <option value="">— elegir colaborador —</option>
            {colaboradores.filter((c) => !d.personal.includes(c.nombre)).map((c) => (
              <option key={c.id} value={c.nombre}>
                {c.nombre} {codigo(c.id)}{c.activo ? '' : ' · inactivo'}
              </option>
            ))}
          </select>
        </label>
        <div className="campo campo--ancho">
          {d.personal.length === 0
            ? <p className="campo__leido tenue">Nadie todavía.</p>
            : (
              <ul className="lista-quitar">
                {d.personal.map((p) => (
                  <li key={p}>
                    {p}
                    <button type="button" className="boton boton--plano" aria-label={`Quitar a ${p}`}
                      onClick={() => quitarPersona(p)}>quitar</button>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </fieldset>

      <fieldset className="grupo campo--ancho">
        <legend>Horas e importes</legend>
        <label className="campo">
          <span>Horas contratadas</span>
          <input type="text" inputMode="decimal" value={d.horasContratadas}
            onChange={(e) => poner('horasContratadas', e.target.value)} />
        </label>
        <label className="campo">
          <span>Horas extras</span>
          <input type="text" inputMode="decimal" value={d.horasExtras}
            onChange={(e) => poner('horasExtras', e.target.value)} />
        </label>
        <div className="campo">
          <span>Total horas</span>
          <output className="campo__leido">{cifra(totales.totalHoras)}</output>
        </div>

        {IMPORTES_HOJA.map((i) => (
          <label key={i.campo} className="campo">
            <span>{i.texto} (€)</span>
            <input type="text" inputMode="decimal" value={d.importes[i.campo]}
              onChange={(e) => poner('importes', { ...d.importes, [i.campo]: e.target.value })} />
          </label>
        ))}
        <div className="campo">
          <span><label htmlFor="documento-iva">IVA (%)</label></span>
          <input id="documento-iva" type="text" inputMode="decimal" value={d.iva}
            onChange={(e) => poner('iva', e.target.value)} />
          <span className="campo__ayuda">0 si va sin IVA.</span>
        </div>

        <dl className="totales campo--ancho">
          <div><dt>Subtotal</dt><dd className="dinero">{euros(totales.subtotal)}</dd></div>
          <div><dt>IVA {cifra(totales.ivaPorcentaje)} %</dt><dd className="dinero">{euros(totales.iva)}</dd></div>
          <div className="totales__final"><dt>Total</dt><dd className="dinero">{euros(totales.total)}</dd></div>
        </dl>

        <label className="campo campo--casilla">
          <input type="checkbox" checked={d.productosIncluidos}
            onChange={(e) => poner('productosIncluidos', e.target.checked)} />
          <span>Productos de limpieza incluidos</span>
        </label>
        <label className="campo campo--casilla">
          <input type="checkbox" checked={d.facturado} onChange={(e) => poner('facturado', e.target.checked)} />
          <span>Facturado</span>
        </label>
      </fieldset>
    </>
  );
}

// ── Cuenta de cobro ─────────────────────────────────────────────────────────

function Cobro({ d, setD, poner }) {
  const totales = calcular('cobro', d);

  const ponerLinea = (i, campo, valor) => setD((x) => ({
    ...x, lineas: x.lineas.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)),
  }));
  const quitarLinea = (i) => setD((x) => ({ ...x, lineas: x.lineas.filter((_, j) => j !== i) }));
  const añadirLinea = () => setD((x) => ({ ...x, lineas: [...x.lineas, nuevaLinea()] }));

  return (
    <fieldset className="grupo campo--ancho">
      <legend>Detalle</legend>
      <div className="tabla-envoltorio campo--ancho">
        <table className="tabla tabla--edicion">
          <thead>
            <tr>
              <th scope="col">Descripción</th>
              <th scope="col">Fecha</th>
              <th scope="col" className="num">Cantidad</th>
              <th scope="col" className="num">Valor total</th>
              <th scope="col" className="num">Unitario</th>
              <th scope="col"><span className="visualmente-oculto">Quitar</span></th>
            </tr>
          </thead>
          <tbody>
            {d.lineas.map((l, i) => (
              <tr key={i}>
                <td><input type="text" aria-label="Descripción" value={l.descripcion}
                  onChange={(e) => ponerLinea(i, 'descripcion', e.target.value)} /></td>
                <td><input type="date" aria-label="Fecha" value={l.fecha}
                  onChange={(e) => ponerLinea(i, 'fecha', e.target.value)} /></td>
                <td className="tabla--edicion__corta">
                  <input type="text" inputMode="decimal" aria-label="Cantidad" value={l.cantidad}
                    onChange={(e) => ponerLinea(i, 'cantidad', e.target.value)} /></td>
                <td className="tabla--edicion__corta">
                  <input type="text" inputMode="decimal" aria-label="Valor total" value={l.importe}
                    onChange={(e) => ponerLinea(i, 'importe', e.target.value)} /></td>
                <td className="dinero">{euros(totales.lineas[i].unitario)}</td>
                <td>
                  <button type="button" className="boton boton--plano" onClick={() => quitarLinea(i)}
                    disabled={d.lineas.length === 1}>
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3}>Total</th>
              <td className="dinero">{euros(totales.total)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="grupo__pie">
        <button type="button" className="boton" onClick={añadirLinea}>Añadir línea</button>
        <span className="campo__ayuda">
          Se escribe el valor total de cada línea; el unitario sale de dividir por la cantidad.
          La fecha de cada línea es opcional.
        </span>
      </div>

      <label className="campo">
        <span>Total horas</span>
        <input type="text" inputMode="decimal" value={d.totalHoras}
          onChange={(e) => poner('totalHoras', e.target.value)} />
      </label>
    </fieldset>
  );
}
