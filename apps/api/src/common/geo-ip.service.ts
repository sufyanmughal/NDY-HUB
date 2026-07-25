import { Injectable, Logger } from '@nestjs/common';

const LOOKUP_TIMEOUT_MS = 1500;

/**
 * Best-effort "City, Region, Country" for a login request's origin, shown
 * next to the device/browser on the QR/deep-link approval screen so a
 * person can tell "is this actually me" at a glance. ip-api.com's free
 * tier needs no API key — fine for this (a display nicety, not something
 * security decisions are made on). Never throws: a failed or skipped
 * lookup just means the field stays blank, same as it always was before
 * this existed.
 */
@Injectable()
export class GeoIpService {
  private readonly logger = new Logger(GeoIpService.name);

  async lookupLocation(ip: string | undefined): Promise<string | undefined> {
    if (!ip || isPrivateIp(ip)) return undefined;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    try {
      const res = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,regionName,country`,
        { signal: controller.signal },
      );
      if (!res.ok) return undefined;
      const data = (await res.json()) as {
        status: string;
        city?: string;
        regionName?: string;
        country?: string;
      };
      if (data.status !== 'success') return undefined;
      const parts = [data.city, data.regionName, data.country].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : undefined;
    } catch (err) {
      this.logger.warn(
        `Geo-IP lookup failed for ${ip}: ${(err as Error).message}`,
      );
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function isPrivateIp(ip: string): boolean {
  const normalized = ip.replace(/^::ffff:/, '');
  return (
    normalized === '::1' ||
    /^127\./.test(normalized) ||
    /^10\./.test(normalized) ||
    /^192\.168\./.test(normalized) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(normalized) ||
    /^fc00:/.test(normalized) ||
    /^fe80:/.test(normalized)
  );
}
