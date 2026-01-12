/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'dockerode'],
    instrumentationHook: true
  }
}

module.exports = nextConfig
