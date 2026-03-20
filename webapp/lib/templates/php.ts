import Docker from 'dockerode';

export interface PhpTemplateConfig {
  domain: string;
  codePath: string;
  siteId: number;
  userId: number;
  folderId?: number;
  includeWww?: boolean;
}

export function generatePhpTemplate(config: PhpTemplateConfig): Docker.ContainerCreateOptions {
  const containerName = `docklite-site${config.siteId}-${config.domain.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const includeWww = config.includeWww ?? true;

  return {
    Image: 'webdevops/php-nginx:8.2-alpine',
    name: containerName,
    ExposedPorts: {
      '80/tcp': {}
    },
    Env: [
      'WEB_DOCUMENT_ROOT=/app',
      'PHP_DISPLAY_ERRORS=1',
      'PHP_MEMORY_LIMIT=256M',
      'PHP_MAX_EXECUTION_TIME=300',
      'PHP_POST_MAX_SIZE=50M',
      'PHP_UPLOAD_MAX_FILESIZE=50M'
    ],
    HostConfig: {
      Binds: [
        `${config.codePath}:/app:rw`
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
      'docklite.type': 'php',
      'docklite.user.id': config.userId.toString(),
      'docklite.folder.id': config.folderId?.toString() || '',
      'docklite.include_www': includeWww ? 'true' : 'false',
      'docklite.internal_port': '80',
    }
  };
}
