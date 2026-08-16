import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

const SECCIONES = [
  { href: '/', texto: 'Resumen' },
  { href: '/servicios', texto: 'Servicios' },
  { href: '/clientes', texto: 'Clientes' },
  { href: '/colaboradores', texto: 'Colaboradores' },
  { href: '/gastos', texto: 'Gastos' },
  { href: '/meses', texto: 'Meses' },
  { href: '/exportar', texto: 'Exportar' },
];

export default function Navegacion({ pendientes, conSesion }) {
  const porRevisar = (pendientes?.avisos ?? 0) + (pendientes?.fusiones ?? 0);

  return (
    <header className="cabecera">
      <Link href="/" className="cabecera__marca">
        Limpiezas El Imperio
      </Link>

      <nav className="cabecera__nav" aria-label="Secciones">
        {SECCIONES.map((s) => (
          <Link key={s.href} href={s.href}>{s.texto}</Link>
        ))}
        <Link href="/revisar" className="cabecera__revisar">
          Revisar
          {porRevisar > 0 && <span className="pastilla">{porRevisar}</span>}
        </Link>
      </nav>

      {conSesion && (
        <div className="cabecera__sesion">
          <UserButton />
        </div>
      )}
    </header>
  );
}
