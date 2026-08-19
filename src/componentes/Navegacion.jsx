import Link from 'next/link';
import BotonUsuario from './BotonUsuario.jsx';

const SECCIONES = [
  { href: '/', texto: 'Resumen' },
  { href: '/preparar', texto: 'Preparar mes' },
  { href: '/servicios', texto: 'Servicios' },
  { href: '/clientes', texto: 'Clientes' },
  { href: '/colaboradores', texto: 'Colaboradores' },
  { href: '/gastos', texto: 'Gastos' },
  { href: '/meses', texto: 'Meses' },
  { href: '/exportar', texto: 'Exportar' },
];

export default function Navegacion({ pendientes, usuario }) {
  const porRevisar = (pendientes?.avisos ?? 0) + (pendientes?.fusiones ?? 0);
  const borradores = pendientes?.borradores ?? 0;

  return (
    <header className="cabecera">
      <Link href="/" className="cabecera__marca">
        Limpiezas El Imperio
      </Link>

      <nav className="cabecera__nav" aria-label="Secciones">
        {SECCIONES.map((s) => (
          <Link key={s.href} href={s.href} className={
            s.href === '/preparar' ? 'cabecera__revisar' : undefined}>
            {s.texto}
            {s.href === '/preparar' && borradores > 0 && (
              <span className="pastilla pastilla--tenue">{borradores}</span>
            )}
          </Link>
        ))}
        <Link href="/revisar" className="cabecera__revisar">
          Revisar
          {porRevisar > 0 && <span className="pastilla">{porRevisar}</span>}
        </Link>
      </nav>

      {usuario && (
        <div className="cabecera__sesion">
          <BotonUsuario usuario={usuario} />
        </div>
      )}
    </header>
  );
}
