import { Controller, Get, Header, Param, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { NdyqrService } from './ndyqr.service';
import { NdyQrRenderService } from './ndyqr-render.service';

/**
 * The public surface of NDYQR™ — both halves.
 *
 *   GET /q/:slug             the stable short link a code encodes (302)
 *   GET /q/:slug/image.svg   the branded code, vector
 *   GET /q/:slug/image.png   the branded code, raster
 *
 * All three are unauthenticated by design (whoever scans or fetches has no
 * session) and throttled for the same reason. The image endpoints exist so
 * NON-JS clients — a mobile app, a print pipeline — can get a branded code
 * without porting or re-running the web renderer.
 *
 * The image endpoints deliberately do NOT record a scan: fetching the image of
 * a code is not someone scanning it, and counting it would corrupt the very
 * analytics this feature exists to provide.
 */
@Controller('q')
export class NdyQrRedirectController {
  constructor(
    private readonly ndyqr: NdyqrService,
    private readonly renderer: NdyQrRenderService,
  ) {}

  @Get(':slug')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async resolve(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const destination = await this.ndyqr.resolveDestination(slug, req);
    if (!destination) {
      res
        .status(404)
        .type('text/plain')
        .send('This NDYQR™ code is not available.');
      return;
    }
    res.redirect(302, destination);
  }

  @Get(':slug/image.svg')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Header('Cache-Control', 'public, max-age=300')
  async imageSvg(
    @Param('slug') slug: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.sendImage(slug, 'svg', res);
  }

  @Get(':slug/image.png')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Header('Cache-Control', 'public, max-age=300')
  async imagePng(
    @Param('slug') slug: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.sendImage(slug, 'png', res);
  }

  /** Shared render + validate + send for both formats. Validation runs
   * server-side before anything is returned — an unscannable code is a 500, not
   * a silently-broken download (the same guarantee the web renderer gives). */
  private async sendImage(
    slug: string,
    format: 'svg' | 'png',
    res: Response,
  ): Promise<void> {
    const code = await this.ndyqr.findActiveBySlug(slug);
    if (!code) {
      res
        .status(404)
        .type('text/plain')
        .send('This NDYQR™ code is not available.');
      return;
    }

    const text = this.ndyqr.publicUrlFor(code.slug);
    const options = { colorFrom: code.colorFrom, colorTo: code.colorTo };

    const png = await this.renderer.renderPng(text, options);
    if ((await this.renderer.decodePng(png)) !== text) {
      res
        .status(500)
        .type('text/plain')
        .send('Could not render a scannable code for this NDYQR™ code.');
      return;
    }

    if (format === 'svg') {
      res.type('image/svg+xml').send(this.renderer.renderSvg(text, options));
      return;
    }
    res.type('image/png').send(png);
  }
}
