/** @type {import('next').NextConfig} */
const nextConfig = {
  // Los datos son de un solo negocio y cambian cuando él los cambia: cachear
  // páginas aquí sólo serviría para enseñarle cifras viejas.
  experimental: {},

  // Identificador del despliegue. Con esto puesto, Next cuelga `?dpl=…` de cada
  // archivo estático —así el navegador no puede reutilizar el de ayer— y manda
  // la marca en cada navegación; si el servidor ve una distinta a la suya,
  // fuerza una recarga entera en vez de seguir con el código viejo.
  //
  // Es lo que le faltaba a la pestaña que él deja abierta días: cada despliegue
  // cambia el identificador de las acciones de servidor, la pestaña vieja manda
  // uno que ya no existe y guardar fallaba en silencio. Ahora se recarga sola.
  //
  // Sale de Vercel y no se escribe a mano: `VERCEL_DEPLOYMENT_ID` cambia en cada
  // despliegue, y el sha del commit sirve de reserva. En local las dos están
  // vacías, así que queda `undefined` y todo funciona como siempre.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA,

  async headers() {
    return [{
      source: '/:ruta*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    }];
  },
};

export default nextConfig;
