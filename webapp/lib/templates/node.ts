import Docker from 'dockerode';

export interface NodeTemplateConfig {
  domain: string;
  codePath: string;
  siteId: number;
  userId: number;
  folderId?: number;
  port?: number;
  includeWww?: boolean;
}

export function generateNodeTemplate(config: NodeTemplateConfig): Docker.ContainerCreateOptions {
  const containerName = `docklite-site${config.siteId}-${config.domain.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const internalPort = config.port || 3000;
  const includeWww = config.includeWww ?? true;

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
        [`${internalPort}/tcp`]: [{ HostPort: '0' }]
      },
      RestartPolicy: {
        Name: 'unless-stopped'
      },
      NetworkMode: 'docklite_network'
    },
    Labels: {
      'docklite.managed': 'true',
      'docklite.site.id': config.siteId.toString(),
      'docklite.domain': config.domain,
      'docklite.type': 'node',
      'docklite.user.id': config.userId.toString(),
      'docklite.folder.id': config.folderId?.toString() || '',
      'docklite.include_www': includeWww ? 'true' : 'false',
      'docklite.internal_port': internalPort.toString(),
    }
  };
}
