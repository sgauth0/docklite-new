import Docker from 'dockerode';

export interface NodeTemplateConfig {
  domain: string;
  codePath: string;
  siteId: number;
  userId: number;
  folderId?: number;
  port?: number; // Internal port the Node app listens on (default: 3000)
  includeWww?: boolean;
}

export function generateNodeTemplate(config: NodeTemplateConfig): Docker.ContainerCreateOptions {
  const containerName = `docklite-site${config.siteId}-${config.domain.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const sanitizedDomain = config.domain.replace(/[^a-zA-Z0-9]/g, '-');
  const internalPort = config.port || 3000;
  const includeWww = config.includeWww ?? true;

  const hostRule = includeWww && !config.domain.startsWith('www.')
    ? `Host(\`${config.domain}\`,\`www.${config.domain}\`)`
    : `Host(\`${config.domain}\`)`;

  return {
    Image: 'node:20-alpine',
    name: containerName,
    WorkingDir: '/app',
    Cmd: ['npm', 'start'],
    ExposedPorts: {
      [`${internalPort}/tcp`]: {}
    },
    Env: [
      'NODE_ENV=production',
      `PORT=${internalPort}`
    ],
    HostConfig: {
      Binds: [
        `${config.codePath}:/app:rw`
      ],
      PortBindings: {
        [`${internalPort}/tcp`]: [{ HostPort: '0' }] // Auto-assign port
      },
      RestartPolicy: {
        Name: 'unless-stopped'
      },
      NetworkMode: 'docklite_network' // Connect to Traefik network
    },
    Labels: {
      'docklite.managed': 'true',
      'docklite.site.id': config.siteId.toString(),
      'docklite.domain': config.domain,
      'docklite.type': 'node',
      'docklite.user.id': config.userId.toString(),
      'docklite.folder.id': config.folderId?.toString() || '',
      // Traefik labels
      'traefik.enable': 'true',
      [`traefik.http.routers.docklite-${sanitizedDomain}.rule`]: hostRule,
      [`traefik.http.routers.docklite-${sanitizedDomain}.entrypoints`]: 'websecure',
      [`traefik.http.routers.docklite-${sanitizedDomain}.tls`]: 'true',
      [`traefik.http.routers.docklite-${sanitizedDomain}.tls.certresolver`]: 'letsencrypt',
      [`traefik.http.services.docklite-${sanitizedDomain}.loadbalancer.server.port`]: internalPort.toString(),
    }
  };
}
