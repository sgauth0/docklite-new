import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import fs from 'fs/promises';
import crypto from 'crypto';
import { listContainers } from '@/lib/docker';
import { getAllSites } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface TraefikRouter {
  name: string;
  rule: string;
  tls?: {
    certResolver?: string;
    options?: string;
  };
  provider: string;
}

interface CertificateEntry {
  domain: {
    main: string;
    sans?: string[];
  };
  certificate: string; // base64
  key?: string;
}

interface SslStatus {
  domain: string;
  hasSSL: boolean;
  expiryDate: string | null;
  daysUntilExpiry: number | null;
  status: 'valid' | 'expiring' | 'expired' | 'none';
}

const DEFAULT_ACME_PATHS = [
  ...new Set(
    (process.env.ACME_PATHS || process.env.ACME_PATH || '')
      .split(',')
      .map((path) => path.trim())
      .filter(Boolean)
      .concat('/letsencrypt/acme.json')
  ),
];

const TRAEFIK_API_URL = process.env.TRAEFIK_API_URL || 'http://localhost:8080';

async function loadAcme(): Promise<{ entries: CertificateEntry[] | null; path: string | null }> {
  for (const candidate of DEFAULT_ACME_PATHS) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const json = JSON.parse(raw);
      const entries =
        (json?.letsencrypt?.Certificates as CertificateEntry[] | undefined) ||
        (json?.Certificates as CertificateEntry[] | undefined) ||
        null;
      if (entries) {
        return { entries, path: candidate };
      }
    } catch {
      // try next path
    }
  }
  return { entries: null, path: null };
}

async function loadTraefikCertificates(): Promise<{ entries: CertificateEntry[] | null; path: string | null }> {
  try {
    const res = await fetch(`${TRAEFIK_API_URL}/api/tls/certificates`);
    if (!res.ok) return { entries: null, path: null };
    const entries = (await res.json()) as CertificateEntry[];
    if (Array.isArray(entries) && entries.length > 0) {
      return { entries, path: `${TRAEFIK_API_URL}/api/tls/certificates` };
    }
  } catch {
    // ignore
  }
  return { entries: null, path: null };
}

function getHostsFromRule(rule: string): string[] {
  // Extract all backtick-quoted strings from Host() rules
  // Traefik format: Host(`domain1`,`domain2`) or Host(`domain1`) || Host(`domain2`)
  const backtickMatches = [...rule.matchAll(/`([^`]+)`/g)];
  if (backtickMatches.length > 0) {
    return backtickMatches.map(m => m[1].trim()).filter(Boolean);
  }
  return [];
}

function buildCertMap(entries: CertificateEntry[] | null): Map<string, CertificateEntry> {
  const map = new Map<string, CertificateEntry>();
  if (!entries) return map;
  for (const entry of entries) {
    if (entry.domain?.main) {
      map.set(entry.domain.main, entry);
      (entry.domain.sans || []).forEach((san) => map.set(san, entry));
    }
  }
  return map;
}

function getExpiry(certEntry: CertificateEntry | undefined): { expiryDate: string | null; daysUntilExpiry: number | null; status: SslStatus['status'] } {
  if (!certEntry?.certificate) {
    return { expiryDate: null, daysUntilExpiry: null, status: 'none' };
  }
  try {
    const certRaw = certEntry.certificate;
    const certData = certRaw.includes('BEGIN CERTIFICATE')
      ? certRaw
      : Buffer.from(certRaw, 'base64');
    const x509 = new crypto.X509Certificate(certData);
    const expiryDate = new Date(x509.validTo);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    let status: SslStatus['status'] = 'valid';
    if (daysUntilExpiry < 0) status = 'expired';
    else if (daysUntilExpiry < 30) status = 'expiring';
    return { expiryDate: expiryDate.toISOString(), daysUntilExpiry, status };
  } catch (err) {
    console.error('Failed to parse certificate:', err);
    return { expiryDate: null, daysUntilExpiry: null, status: 'none' };
  }
}

export async function GET() {
  try {
    await requireAuth();

    // Try Traefik HTTP API first (avoids needing Docker socket)
    let uniqueHosts: Array<{ host: string; tlsResolver?: string }> = [];
    try {
      const res = await fetch(`${TRAEFIK_API_URL}/api/http/routers`);
      if (res.ok) {
        const routers: TraefikRouter[] = await res.json();
        const dockliteRouters = routers.filter(
          (router) => router.provider === 'docker' && router.name.toLowerCase().includes('docklite')
        );
        console.log(`[SSL] Found ${routers.length} total routers, ${dockliteRouters.length} DockLite routers`);
        for (const router of dockliteRouters) {
          console.log(`[SSL] Processing router: ${router.name}, rule="${router.rule}"`);
          const hosts = getHostsFromRule(router.rule);
          console.log(`[SSL] Extracted hosts: [${hosts.join(', ')}], certResolver=${router.tls?.certResolver}`);
          hosts.forEach((host) =>
            uniqueHosts.push({
              host,
              tlsResolver: router.tls?.certResolver,
            })
          );
        }
        console.log(`[SSL] Total uniqueHosts: ${uniqueHosts.length}`);
      }
    } catch (err) {
      console.error('[SSL] Traefik API error:', err);
      // Ignore and fall back to docker labels
    }

    // If no hosts from API, fall back to managed containers (requires Docker socket)
    if (uniqueHosts.length === 0) {
      try {
        const containers = await listContainers(true);
        const hostEntries: Array<{ host: string; tlsResolver?: string }> = [];
        for (const c of containers) {
          const labels = c.labels || {};
          for (const [key, value] of Object.entries(labels)) {
            const match = key.match(/^traefik\.http\.routers\.([^.]+)\.rule$/);
            if (match && typeof value === 'string') {
              const hosts = getHostsFromRule(value);
              const resolver =
                labels[`traefik.http.routers.${match[1]}.tls.certresolver`] ||
                labels[`traefik.http.routers.${match[1]}.tls.certResolver`];
              hosts.forEach((host) =>
                hostEntries.push({ host, tlsResolver: typeof resolver === 'string' ? resolver : undefined })
              );
            }
          }
        }
        uniqueHosts = Array.from(new Set(hostEntries.map((h) => h.host))).map((host) => {
          const entry = hostEntries.find((h) => h.host === host);
          return { host, tlsResolver: entry?.tlsResolver };
        });
      } catch {
        // continue
      }
    }

    // Always include DockLite sites from the database as managed hosts
    try {
      const sites = getAllSites();
      const knownHosts = new Set(uniqueHosts.map((h) => h.host));
      for (const site of sites) {
        if (!knownHosts.has(site.domain)) {
          uniqueHosts.push({ host: site.domain, tlsResolver: 'letsencrypt' });
          knownHosts.add(site.domain);
        }
      }
    } catch {
      // ignore
    }

    const { entries: acmeEntries, path: acmePath } = await loadAcme();
    let certEntries = acmeEntries;
    let certSource = acmePath;
    if (!certEntries || certEntries.length === 0) {
      const { entries: apiEntries, path: apiPath } = await loadTraefikCertificates();
      if (apiEntries) {
        certEntries = apiEntries;
        certSource = apiPath;
      }
    }

    const certMap = buildCertMap(certEntries);

    const managedStatuses: SslStatus[] = [];
    const allStatuses: SslStatus[] = [];

    console.log(`[SSL] Building statuses: uniqueHosts=${uniqueHosts.length}, certMap size=${certMap.size}`);

    // Build managed container statuses (DockLite only)
    if (uniqueHosts.length > 0) {
      for (const { host, tlsResolver } of uniqueHosts) {
        const hasTls = tlsResolver === 'letsencrypt';
        if (!hasTls) {
          managedStatuses.push({
            domain: host,
            hasSSL: false,
            expiryDate: null,
            daysUntilExpiry: null,
            status: 'none',
          });
          continue;
        }

        const certEntry = certMap.get(host) || certMap.get(host.replace('www.', ''));
        const { expiryDate, daysUntilExpiry, status } = getExpiry(certEntry);

        managedStatuses.push({
          domain: host,
          hasSSL: !!certEntry,
          expiryDate,
          daysUntilExpiry,
          status: certEntry ? status : 'none',
        });
      }
    }

    // Build list of ALL certs from acme.json
    for (const [host, certEntry] of certMap.entries()) {
      const { expiryDate, daysUntilExpiry, status } = getExpiry(certEntry);
      allStatuses.push({
        domain: host,
        hasSSL: true,
        expiryDate,
        daysUntilExpiry,
        status,
      });
    }

    console.log(`[SSL] Final counts: managed=${managedStatuses.length}, all=${allStatuses.length}`);
    console.log(`[SSL] Returning ${managedStatuses.length > 0 ? 'managed' : 'all'} statuses as default`);

    return NextResponse.json({
      sites: managedStatuses.length > 0 ? managedStatuses : allStatuses,
      allSites: allStatuses,
      meta: {
        acmePath: certSource,
        certCount: certEntries?.length ?? 0,
        hostsFound: uniqueHosts.length,
        managedCount: managedStatuses.length,
        allCount: allStatuses.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching SSL status:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
