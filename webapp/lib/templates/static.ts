import Docker from 'dockerode';

export interface StaticTemplateConfig {
  domain: string;
  codePath: string;
  siteId: number;
  userId: number;
  folderId?: number;
  includeWww?: boolean;
}

export function generateStaticTemplate(config: StaticTemplateConfig): Docker.ContainerCreateOptions {
  const containerName = `docklite-site${config.siteId}-${config.domain.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const includeWww = config.includeWww ?? true;

  return {
    Image: 'nginx:alpine',
    name: containerName,
    ExposedPorts: {
      '80/tcp': {}
    },
    HostConfig: {
      Binds: [
        `${config.codePath}:/usr/share/nginx/html:ro`
      ],
      PortBindings: {
        '80/tcp': [{ HostPort: '0' }]
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
      'docklite.type': 'static',
      'docklite.user.id': config.userId.toString(),
      'docklite.folder.id': config.folderId?.toString() || '',
      'docklite.include_www': includeWww ? 'true' : 'false',
      'docklite.internal_port': '80',
    }
  };
}
