/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

const nextConfig = {
  reactCompiler: true,
  // Static export for Electron production build
  ...(isProd ? { output: 'export' } : {}),
  // Disable image optimization for Electron
  images: { unoptimized: true },
};

export default nextConfig;
