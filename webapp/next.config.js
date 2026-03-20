/** @type {import('next').NextConfig} */
const agentUrl =
  process.env.AGENT_URL ||
  process.env.DOCKLITE_AGENT_URL ||
  'http://localhost:3000';
const normalizedAgentUrl = agentUrl.replace(/\/+$/, '');

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'dockerode'],
    instrumentationHook: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${normalizedAgentUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
