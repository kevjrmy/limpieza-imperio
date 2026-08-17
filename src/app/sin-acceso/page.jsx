import { SignOutButton } from '@clerk/nextjs';

/**
 * Cuenta identificada, pero sin acceso.
 *
 * Cuelga del layout raíz y NO del grupo `(panel)`, a propósito y por el mismo
 * motivo que `/entrar`: el layout de `(panel)` llama a `exigirSesion()`, que es
 * justo quien manda aquí. Colgarla de ahí sería un bucle de redirecciones.
 *
 * Lleva botón de salir porque si no la persona se queda encerrada: con sesión
 * abierta, rechazada, y sin manera de probar con otra cuenta.
 */
export const metadata = { title: 'Sin acceso · Limpiezas El Imperio' };

export default function SinAcceso() {
  return (
    <main className="bloqueo">
      <h1>Esta cuenta no tiene acceso</h1>
      <p>
        Has entrado correctamente, pero este correo no está en la lista de los que
        pueden ver la contabilidad de Limpiezas El Imperio.
      </p>
      <p>
        Si debería estarlo, hay que añadirlo a <code>CORREOS_AUTORIZADOS</code>.
        Si te has equivocado de cuenta, sal y entra con la otra.
      </p>
      <p>
        <SignOutButton>
          <button type="button" className="boton">Salir</button>
        </SignOutButton>
      </p>
    </main>
  );
}
