import Docker from 'dockerode';

export interface DatabaseTemplateConfig {
  name: string;
  port: number;
  username?: string;
  password?: string;
}

export function generateDatabaseTemplate(config: DatabaseTemplateConfig): Docker.ContainerCreateOptions {
  const containerName = `docklite-db-${config.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const username = config.username || 'docklite';
  const password = config.password || generateRandomPassword();

  return {
    Image: 'postgres:16-alpine',
    name: containerName,
    Env: [
      `POSTGRES_DB=${config.name}`,
      `POSTGRES_USER=${username}`,
      `POSTGRES_PASSWORD=${password}`,
    ],
    ExposedPorts: {
      '5432/tcp': {}
    },
    HostConfig: {
      PortBindings: {
        '5432/tcp': [{ HostPort: config.port.toString() }]
      },
      RestartPolicy: {
        Name: 'unless-stopped'
      }
    },
    Labels: {
      'docklite.managed': 'true',
      'docklite.database': config.name,
      'docklite.type': 'postgres',
      'docklite.username': username,
      'docklite.password': password, // Store in label for retrieval (not ideal for production)
    }
  };
}

function generateRandomPassword(): string {
  return Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
}
