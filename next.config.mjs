/** @type {import('next').NextConfig} */
const config = {
  // Standalone output for the Docker runtime — ships a minimal `server.js`
  // plus only the traced production deps (no node_modules tree, no source).
  output: 'standalone',
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  webpack: config => {
    config.externals = [...(config.externals ?? []), { canvas: 'canvas' }]
    return config
  },
}

export default config
