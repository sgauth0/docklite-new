import type { DNSRecordType } from '@/types';

export interface CloudflareRecord {
  id: string;
  type: DNSRecordType;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  priority?: number;
  zone_id: string;
  zone_name: string;
  created_on: string;
  modified_on: string;
}

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  account: {
    id: string;
    name: string;
  };
}

export class CloudflareClient {
  private apiToken: string;
  private baseUrl = 'https://api.cloudflare.com/client/v4';

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errors = data.errors?.map((e: any) => e.message).join(', ') || 'Unknown error';
      throw new Error(`Cloudflare API error: ${errors}`);
    }

    return data.result as T;
  }

  // Get all zones
  async getZones(): Promise<CloudflareZone[]> {
    return this.request<CloudflareZone[]>('/zones');
  }

  // Get zone by ID
  async getZone(zoneId: string): Promise<CloudflareZone> {
    return this.request<CloudflareZone>(`/zones/${zoneId}`);
  }

  // List DNS records for a zone
  async listDNSRecords(zoneId: string): Promise<CloudflareRecord[]> {
    return this.request<CloudflareRecord[]>(`/zones/${zoneId}/dns_records`);
  }

  // Get a specific DNS record
  async getDNSRecord(zoneId: string, recordId: string): Promise<CloudflareRecord> {
    return this.request<CloudflareRecord>(`/zones/${zoneId}/dns_records/${recordId}`);
  }

  // Create a DNS record
  async createDNSRecord(
    zoneId: string,
    record: {
      type: DNSRecordType;
      name: string;
      content: string;
      ttl?: number;
      priority?: number;
      proxied?: boolean;
    }
  ): Promise<CloudflareRecord> {
    return this.request<CloudflareRecord>(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({
        type: record.type,
        name: record.name,
        content: record.content,
        ttl: record.ttl || 1, // 1 = automatic
        priority: record.priority,
        proxied: record.proxied ?? false,
      }),
    });
  }

  // Update a DNS record
  async updateDNSRecord(
    zoneId: string,
    recordId: string,
    record: {
      type: DNSRecordType;
      name: string;
      content: string;
      ttl?: number;
      priority?: number;
      proxied?: boolean;
    }
  ): Promise<CloudflareRecord> {
    return this.request<CloudflareRecord>(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify({
        type: record.type,
        name: record.name,
        content: record.content,
        ttl: record.ttl || 1,
        priority: record.priority,
        proxied: record.proxied ?? false,
      }),
    });
  }

  // Delete a DNS record
  async deleteDNSRecord(zoneId: string, recordId: string): Promise<void> {
    await this.request<{ id: string }>(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'DELETE',
    });
  }

  // Verify token is valid
  async verifyToken(): Promise<boolean> {
    try {
      await this.request('/user/tokens/verify');
      return true;
    } catch {
      return false;
    }
  }
}
