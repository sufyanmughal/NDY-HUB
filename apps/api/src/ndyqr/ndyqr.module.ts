import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OAuthModule } from '../oauth/oauth.module';
import { NdyqrController } from './ndyqr.controller';
import { NdyQrRedirectController } from './ndyqr-redirect.controller';
import { NdyQrServiceController } from './ndyqr-service.controller';
import { NdyqrService } from './ndyqr.service';
import { NdyQrRenderService } from './ndyqr-render.service';
import { NdyQrClientGuard } from './guards/ndyqr-client.guard';
import { GeoIpService } from '../common/geo-ip.service';
import { PermissionGuard } from '../common/guards/permission.guard';

/**
 * NDYQR™ — the central dynamic QR service (see docs/ndyqr.md).
 *
 * AuthModule is imported (not forwardRef'd) for JwtAuthGuard, the same
 * one-directional dependency every guarded feature module in this app takes.
 * GeoIpService is provided here rather than reused from AuthModule because
 * AuthModule keeps it private — same reasoning as its own provider list.
 * NdyqrService is exported so other modules (and, later, the ecosystem's
 * cross-product API) can create/resolve codes without duplicating storage.
 */
@Module({
  imports: [AuthModule, OAuthModule],
  controllers: [
    NdyqrController,
    NdyQrRedirectController,
    NdyQrServiceController,
  ],
  providers: [
    NdyqrService,
    NdyQrRenderService,
    NdyQrClientGuard,
    GeoIpService,
    PermissionGuard,
  ],
  exports: [NdyqrService],
})
export class NdyqrModule {}
