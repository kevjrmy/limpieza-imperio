'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import Documento from './Documento.jsx';
import FormularioDocumento from './FormularioDocumento.jsx';
import { borrarDocumento } from '../lib/acciones.js';
import { TIPOS, copiaParaNueva, documentoVacio, paraFormulario } from '../lib/documentos.js';
import { intentar } from './intentar.js';
import { codigo } from '../lib/formato.js';

/**
 * Un documento guardado: se lee, se imprime, se edita en el sitio, o se saca
 * otro a partir de él.
 *
 * «Nueva a partir de esta» es lo que pidió con sus palabras —«generar otro sin
 * tener que modificar el anterior»—: abre el formulario con una copia, y al
 * guardar nace otro documento con su propio número. El de aquí no se toca.
 *
 * `siguiente` es el número que se propone para la copia.
 */
export default function PanelDocumento({ doc: delServidor, siguiente, clientes, colaboradores }) {
  const router = useRouter();
  // Lo último guardado desde aquí, hasta que llegue el refresco con lo mismo.
  // Sin esto, entre guardar y que llegara la página nueva se seguía viendo el
  // contenido de antes, y pulsar «Editar» en ese hueco abría el formulario con
  // lo viejo: guardarlo deshacía la edición.
  const [guardado, setGuardado] = useState(null);
  const doc = guardado ? { ...delServidor, ...guardado } : delServidor;
  const t = TIPOS[doc.tipo];
  const [modo, setModo] = useState('leer');   // leer | editar | copiar
  const [enviando, empezar] = useTransition();
  const [error, setError] = useState(null);

  function borrar() {
    if (!confirm(`¿Borrar ${t.articulo} ${codigo(doc.numero)}? No se puede deshacer.`)) return;
    setError(null);
    empezar(async () => {
      const r = await intentar(() => borrarDocumento(doc.id), 'borrar');
      if (r?.error) { setError(r.error); return; }
      router.push(t.ruta);
    });
  }

  if (modo === 'editar') {
    return (
      <FormularioDocumento tipo={doc.tipo} id={doc.id} numero={doc.numero}
        clienteId={doc.cliente_id} inicial={paraFormulario(doc.tipo, doc.contenido)}
        clientes={clientes} colaboradores={colaboradores} alTerminar={() => setModo('leer')}
        alGuardar={(r) => setGuardado({
          numero: r.numero, cliente_id: r.clienteId || null, contenido: r.contenido,
        })} />
    );
  }

  if (modo === 'copiar') {
    return (
      <FormularioDocumento tipo={doc.tipo} numero={siguiente} clienteId={doc.cliente_id}
        inicial={copiaParaNueva(doc.tipo, doc.contenido)} origen={doc.numero}
        clientes={clientes} colaboradores={colaboradores} alTerminar={() => setModo('leer')} />
    );
  }

  return (
    <>
      {error && <p className="alerta alerta--error no-imprimir">{error}</p>}
      <div className="barra-documento no-imprimir">
        <button type="button" className="boton boton--principal" onClick={() => setModo('copiar')}>
          Nueva a partir de esta
        </button>
        <button type="button" className="boton" onClick={() => window.print()}>
          Imprimir o guardar PDF
        </button>
        <button type="button" className="boton" onClick={() => setModo('editar')}>
          Editar
        </button>
        <button type="button" className="boton boton--plano" onClick={borrar} disabled={enviando}>
          Borrar
        </button>
      </div>
      <Documento tipo={doc.tipo} numero={doc.numero} contenido={doc.contenido} />
    </>
  );
}

/**
 * El botón de las listas: abre en el sitio una en blanco. Al guardarla se va a
 * su página, que es donde se ve que existe.
 */
export function NuevoDocumento({ tipo, siguiente, clientes, colaboradores }) {
  const t = TIPOS[tipo];
  const [inicial, setInicial] = useState(null);

  if (!inicial) {
    return (
      <div className="barra-seccion">
        <span />
        <button type="button" className="boton boton--principal"
          onClick={() => setInicial(documentoVacio(tipo))}>
          Nueva {t.nombre.toLowerCase()}
        </button>
      </div>
    );
  }

  return (
    <FormularioDocumento tipo={tipo} numero={siguiente} inicial={inicial}
      clientes={clientes} colaboradores={colaboradores} alTerminar={() => setInicial(null)} />
  );
}
