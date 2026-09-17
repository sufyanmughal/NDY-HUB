import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { NdyQrCode, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeoIpService } from '../common/geo-ip.service';
import { CreateNdyQrDto, UpdateNdyQrDto } from './dto/ndyqr.dto';

/**
 * NDYQR™ — the central dynamic QR service for the NDJOYIT ecosystem.
 *
 * The core idea (client, 2026-09): a code is created once and its *short
 * link* is permanent, while the destination behind it stays editable — so a
 * printed/displayed QR never has to be replaced when its target changes.
 * Every scan is recorded for analytics, and the brand standard (NDY gradient,
 * rounded modules, centered ND logo, high error correction) is applied
 * centrally by the renderer so no product has to reinvent it.
 *
 * This service owns storage, resolution, and scan analytics. The actual image
 * rendering lives in the web client (apps/web/src/lib/ndyqr-render.ts) using
 * the `qrcode` package already in this repo — the API's job is the stable
 * link + data, not pixels.
 */

// Slug alphabet deliberately excludes visually ambiguous characters
// (0/O, 1/l/I) — the same anti-mistake discipline as NDY ID generation, since
// these codes are meant to be read/printed and occasionally typed.
const SLUG_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const generateSlug = customAlphabet(SLUG_ALPHABET, 8);

const DEFAULT_COLOR_FROM = '#e600f0'; // NDY magenta
const DEFAULT_COLOR_TO = '#38bdf8'; // NDY sky
const DEFAULT_BRAND_STYLE = 'ndy-gradient';

@Injectable()
export class NdyqrService {
  private readonly logger = new Logger(NdyqrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geoIp: GeoIpService,
    private readonly config: ConfigService,
  ) {}

  async create(ownerId: string, dto: CreateNdyQrDto): Promise<NdyQrCode> {
    return this.createOwned({ ownerId }, dto);
  }

  /** A code created by a registered product's backend on its own behalf, with
   * no logged-in user (scope ndyqr:create) — attributed to the OAuthClient by
   * its public client id. Lets the ecosystem consume NDYQR centrally instead of
   * each product building its own QR implementation. */
  async createForClient(
    oauthClientId: string,
    dto: CreateNdyQrDto,
  ): Promise<NdyQrCode> {
    return this.createOwned({ oauthClientId }, dto);
  }

  /** Single creation path — exactly one owner is set (the migration's CHECK
   * constraint enforces the same invariant at the database level). */
  private async createOwned(
    owner: { ownerId: string } | { oauthClientId: string },
    dto: CreateNdyQrDto,
  ): Promise<NdyQrCode> {
    const slug = await this.generateUniqueSlug();
    return this.prisma.ndyQrCode.create({
      data: {
        slug,
        ...owner,
        label: dto.label,
        destination: dto.destination,
        type: dto.type ?? 'LINK',
        campaign: dto.campaign ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        brandStyle: dto.brandStyle ?? DEFAULT_BRAND_STYLE,
        colorFrom: dto.colorFrom ?? null,
        colorTo: dto.colorTo ?? null,
        logoUrl: dto.logoUrl ?? null,
      },
    });
  }

  /** Codes owned by this user, newest first, with a scan count for the list
   * view (one aggregate query, not an N+1 per row). */
  async listForUser(ownerId: string) {
    return this.prisma.ndyQrCode.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { scans: true } } },
    });
  }

  /** Platform-wide list for admins (MANAGE_QR_CODES) — Teun's "central"
   * requirement: an operator can see every code in the ecosystem, not just
   * their own. */
  async listAll() {
    return this.prisma.ndyQrCode.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        _count: { select: { scans: true } },
        owner: { select: { ndyId: true, fullName: true } },
      },
    });
  }

  async getOwned(ownerId: string, id: string): Promise<NdyQrCode> {
    const code = await this.prisma.ndyQrCode.findUnique({ where: { id } });
    if (!code || code.ownerId !== ownerId) {
      throw new NotFoundException('No QR code with that id.');
    }
    return code;
  }

  async update(
    ownerId: string,
    id: string,
    dto: UpdateNdyQrDto,
  ): Promise<NdyQrCode> {
    await this.getOwned(ownerId, id);
    const data: Prisma.NdyQrCodeUncheckedUpdateInput = {};
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.destination !== undefined) data.destination = dto.destination;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.campaign !== undefined) data.campaign = dto.campaign;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.expiresAt !== undefined) data.expiresAt = new Date(dto.expiresAt);
    if (dto.brandStyle !== undefined) data.brandStyle = dto.brandStyle;
    if (dto.colorFrom !== undefined) data.colorFrom = dto.colorFrom;
    if (dto.colorTo !== undefined) data.colorTo = dto.colorTo;
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl;

    return this.prisma.ndyQrCode.update({ where: { id }, data });
  }

  async remove(ownerId: string, id: string): Promise<void> {
    await this.getOwned(ownerId, id);
    await this.prisma.ndyQrCode.delete({ where: { id } });
  }

  /** The stable short link a code encodes — the same URL the web renderer turns
   * into pixels, so the server-rendered image and the on-screen one can never
   * encode different things. */
  publicUrlFor(slug: string): string {
    const base = (
      this.config.get<string>('API_URL') ?? `http://localhost:${this.config.get('PORT') ?? 3000}`
    ).replace(/\/$/, '');
    return `${base}/q/${slug}`;
  }

  /** Non-recording lookup for the image endpoints — fetching the image of a
   * code is NOT a scan, so it must not pollute the scan analytics. */
  async findActiveBySlug(slug: string): Promise<NdyQrCode | null> {
    const code = await this.prisma.ndyQrCode.findUnique({ where: { slug } });
    if (!code || !code.isActive) return null;
    if (code.expiresAt && code.expiresAt.getTime() <= Date.now()) return null;
    return code;
  }

  /** The public redirect path. Returns the destination to send the scanner
   * to, or null when the slug is unknown, deactivated, or expired — the
   * controller turns null into a friendly 404. Records the scan
   * fire-and-forget so a slow analytics/geo write never delays the redirect. */
  async resolveDestination(
    slug: string,
    req: Request,
  ): Promise<string | null> {
    const code = await this.prisma.ndyQrCode.findUnique({ where: { slug } });
    if (!code || !code.isActive) return null;
    if (code.expiresAt && code.expiresAt.getTime() <= Date.now()) return null;

    void this.recordScan(code.id, req);
    return code.destination;
  }

  /** Best-effort, never throws outward — a failed analytics write must not
   * affect the user's redirect (same fail-soft contract as every other
   * side-effect record in this codebase). */
  private async recordScan(qrCodeId: string, req: Request): Promise<void> {
    try {
      const userAgentHeader = req.headers['user-agent'];
      const userAgent = Array.isArray(userAgentHeader)
        ? userAgentHeader[0]
        : userAgentHeader;
      const refererHeader = req.headers['referer'] ?? req.headers['referrer'];
      const referer = Array.isArray(refererHeader) ? refererHeader[0] : refererHeader;
      const location = await this.geoIp.lookupLocation(req.ip);

      await this.prisma.ndyQrScan.create({
        data: {
          qrCodeId,
          ip: req.ip ?? null,
          userAgent: userAgent ?? null,
          referer: referer ?? null,
          location: location ?? null,
          deviceType: deviceTypeFromUserAgent(userAgent),
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to record NDYQR scan for code ${qrCodeId}: ${(err as Error).message}`,
      );
    }
  }

  /** Scan analytics for one owned code: lifetime total, a 30-day daily
   * series, device split, and top locations. Aggregated in JS over the
   * 30-day window (small, bounded) rather than a raw SQL date-trunc query —
   * the same "keep it simple until volume justifies otherwise" choice made
   * elsewhere in this codebase. */
  async analytics(ownerId: string, id: string) {
    await this.getOwned(ownerId, id);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [total, recent] = await Promise.all([
      this.prisma.ndyQrScan.count({ where: { qrCodeId: id } }),
      this.prisma.ndyQrScan.findMany({
        where: { qrCodeId: id, scannedAt: { gte: since } },
        select: { scannedAt: true, deviceType: true, location: true },
      }),
    ]);

    const byDayMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      byDayMap.set(d.toISOString().slice(0, 10), 0);
    }
    const deviceMap = new Map<string, number>();
    const locationMap = new Map<string, number>();

    for (const scan of recent) {
      const day = scan.scannedAt.toISOString().slice(0, 10);
      if (byDayMap.has(day)) byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
      const device = scan.deviceType ?? 'unknown';
      deviceMap.set(device, (deviceMap.get(device) ?? 0) + 1);
      if (scan.location) {
        locationMap.set(scan.location, (locationMap.get(scan.location) ?? 0) + 1);
      }
    }

    const sortDesc = (m: Map<string, number>) =>
      [...m.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count);

    return {
      total,
      windowDays: 30,
      byDay: [...byDayMap.entries()].map(([date, count]) => ({ date, count })),
      devices: sortDesc(deviceMap),
      topLocations: sortDesc(locationMap).slice(0, 8),
    };
  }

  /** Brand defaults the web renderer reads so the standard lives in one place
   * even though rendering happens client-side. */
  getBrandDefaults() {
    return {
      brandStyle: DEFAULT_BRAND_STYLE,
      colorFrom: DEFAULT_COLOR_FROM,
      colorTo: DEFAULT_COLOR_TO,
    };
  }

  private async generateUniqueSlug(): Promise<string> {
    for (let attempt = 0; attempt < 6; attempt++) {
      const slug = generateSlug();
      const existing = await this.prisma.ndyQrCode.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing) return slug;
    }
    // 36^8 of space makes this effectively unreachable; throw rather than
    // loop forever if it somehow is.
    throw new Error('Could not allocate a unique NDYQR slug.');
  }
}

/** Cheap device classification from the user agent — enough for the analytics
 * split without pulling in a UA-parsing dependency. */
function deviceTypeFromUserAgent(userAgent: string | undefined): string {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(ua)) return 'mobile';
  if (/bot|crawler|spider|curl|wget|python|axios|node-fetch/.test(ua)) return 'bot';
  return 'desktop';
}
