/** @type {import('next').NextConfig} */
const nextConfig = {
  // Los datos son de un solo negocio y cambian cuando él los cambia: cachear
  // páginas aquí sólo serviría para enseñarle cifras viejas.
  experimental: {},

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
