import Docker from 'dockerode';
import docker from './docker';

export interface DetectedSite {
  containerId: string;
  containerName: string;
  domain?: string;
  type: 'static' | 'php' | 'node' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  codePath?: string;
  ports: string[];
  image: string;
  labels: Record<string, string>;
  reasons: string[];
}

export async function detectSitesInContainers(): Promise<DetectedSite[]> {
  const containers = await docker.listContainers({ all: false });
  const detectedSites: DetectedSite[] = [];

  for (const containerInfo of containers) {
    try {
      const container = docker.getContainer(containerInfo.Id);
      const inspection = await container.inspect();

      const detected = analyzeContainer(inspection);
      // analyzeContainer now returns an array to handle multi-site containers
      if (detected && detected.length > 0) {
        detectedSites.push(...detected);
      }
    } catch (error) {
      console.error(`Error inspecting container ${containerInfo.Id}:`, error);
    }
  }

  return detectedSites;
}

function analyzeContainer(inspection: any): DetectedSite[] {
  const name = inspection.Name.replace(/^\//, '');
  const image = inspection.Config.Image;
  const labels = inspection.Config.Labels || {};
  const mounts = inspection.Mounts || [];
  const ports = inspection.NetworkSettings.Ports || {};

  const reasons: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let type: 'static' | 'php' | 'node' | 'unknown' = 'unknown';
  let domain: string | undefined;
  let codePath: string | undefined;

  // Check for web server ports (80, 443, 8080, 3000, etc.)
  const webPorts = ['80/tcp', '443/tcp', '8080/tcp', '3000/tcp', '8000/tcp'];
  const hasWebPort = webPorts.some(port => ports[port]);

  if (!hasWebPort) {
    return []; // Not a web server
  }

  const baseReasons = ['Exposes web server port'];

  // Check for Traefik-enabled multi-site container
  if (labels['traefik.enable'] === 'true') {
    const sites: DetectedSite[] = [];

    // Extract ALL routers with their domains and service names
    const routers: Map<string, { domain: string; service: string }> = new Map();

    for (const [key, value] of Object.entries(labels)) {
      const routerMatch = key.match(/traefik\.http\.routers\.([^.]+)\.rule/);
      if (routerMatch && typeof value === 'string') {
        const routerName = routerMatch[1];
        const hostMatch = value.match(/Host\(`([^`]+)`\)/);
        if (hostMatch) {
          const domain = hostMatch[1].replace('www.', ''); // Remove www prefix

          // Find the service for this router
          const serviceKey = `traefik.http.routers.${routerName}.service`;
          const serviceName = (labels[serviceKey] as string) || routerName;

          routers.set(routerName, { domain, service: serviceName });
        }
      }
    }

    // For each router/domain, find the matching code path
    for (const [routerName, { domain, service }] of routers) {
      const siteReasons = [...baseReasons, 'Traefik-enabled container', `Router: ${routerName}`, `Domain: ${domain}`];
      let siteCodePath: string | undefined;

      // Try to match service name to mount destination
      // Common patterns: service 'main' → /html/main, 'holofarm' → /html/holofarm
      for (const mount of mounts) {
        if (mount.Type === 'bind') {
          const dest = mount.Destination;
          const source = mount.Source;

          // Skip config directories
          if (dest.includes('/etc/nginx') || dest.includes('/etc/apache') ||
              dest.includes('conf.d') || dest.includes('nginx.conf')) {
            continue;
          }

          // Check if destination matches the service name
          if (dest.includes(`/html/${service}`) ||
              dest.includes(`/${service}`) ||
              dest.endsWith(`/${service}`)) {
            siteCodePath = source;
            siteReasons.push(`Matched mount: ${source} → ${dest}`);
            break;
          }
        }
      }

      // If no match found, try to find any html/www mount with matching path segment
      if (!siteCodePath) {
        for (const mount of mounts) {
          if (mount.Type === 'bind') {
            const dest = mount.Destination;
            const source = mount.Source;

            if (dest.includes('/etc/') || dest.includes('conf')) continue;

            if ((dest.includes('/html') || dest.includes('/www')) &&
                (source.includes(domain) || source.includes(service))) {
              siteCodePath = source;
              siteReasons.push(`Inferred mount: ${source} → ${dest}`);
              break;
            }
          }
        }
      }

      if (siteCodePath || routers.size === 1) {
        sites.push({
          containerId: inspection.Id,
          containerName: name,
          domain,
          type,
          confidence: siteCodePath ? 'high' : 'medium',
          codePath: siteCodePath,
          ports: Object.keys(ports).filter(port => ports[port]).map(port => {
            const hostPort = ports[port][0]?.HostPort;
            return hostPort ? `${hostPort}→${port}` : port;
          }),
          image,
          labels,
          reasons: siteReasons,
        });
      }
    }

    if (sites.length > 0) {
      return sites;
    }
  }

  // Detect type from image
  const imageLower = image.toLowerCase();
  if (imageLower.includes('nginx')) {
    type = 'static';
    reasons.push('nginx image detected');
    confidence = confidence === 'low' ? 'medium' : confidence;
  } else if (imageLower.includes('php') || imageLower.includes('webdevops')) {
    type = 'php';
    reasons.push('PHP image detected');
    confidence = confidence === 'low' ? 'medium' : confidence;
  } else if (imageLower.includes('node')) {
    type = 'node';
    reasons.push('Node.js image detected');
    confidence = confidence === 'low' ? 'medium' : confidence;
  }

  // Find volume mounts that look like web directories
  for (const mount of mounts) {
    if (mount.Type === 'bind') {
      const dest = mount.Destination;
      const source = mount.Source;

      // Skip nginx/apache config directories
      if (dest.includes('/etc/nginx') ||
          dest.includes('/etc/apache') ||
          dest.includes('conf.d') ||
          dest.includes('nginx.conf')) {
        continue;
      }

      // Common web content paths
      if (dest.includes('/usr/share/nginx/html') ||
          dest.includes('/var/www/html') ||
          dest.includes('/var/www') ||
          dest.includes('/app') ||
          dest.includes('/public') ||
          dest.includes('public_html') ||
          dest.includes('/htdocs')) {

        // Prefer paths that look like actual web content
        // Priority: public_html, dist, htdocs > generic html
        const isPrimaryContent = source.includes('public_html') ||
                                 source.includes('htdocs') ||
                                 source.includes('dist') ||
                                 source.match(/\/[^\/]+\.(me|com|org|net|io)$/);

        if (!codePath || isPrimaryContent) {
          codePath = source;
          reasons.push(`Web directory: ${source} → ${dest}`);
          confidence = 'high';
        }
      }
    }
  }

  // Try to extract domain from container name
  if (!domain) {
    // Pattern: sitename_nginx, example.com_nginx, etc.
    const nameParts = name.split('_');
    if (nameParts.length > 1 && nameParts[0].includes('.')) {
      domain = nameParts[0];
      reasons.push(`Domain inferred from name: ${domain}`);
    }
  }

  // Fallback for non-Traefik containers or single-site containers
  reasons.push(...baseReasons);

  // Get exposed ports
  const exposedPorts = Object.keys(ports)
    .filter(port => ports[port] && ports[port].length > 0)
    .map(port => {
      const hostPort = ports[port][0].HostPort;
      return hostPort ? `${hostPort}→${port}` : port;
    });

  return [{
    containerId: inspection.Id,
    containerName: name,
    domain,
    type,
    confidence,
    codePath,
    ports: exposedPorts,
    image,
    labels,
    reasons,
  }];
}

export function shouldImportSite(detected: DetectedSite): boolean {
  // Only import high/medium confidence sites with a code path
  return (
    (detected.confidence === 'high' || detected.confidence === 'medium') &&
    !!detected.codePath
  );
}
