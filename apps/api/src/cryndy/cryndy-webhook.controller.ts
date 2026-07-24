import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CryndyService } from './cryndy.service';
import { CryndyPurchaseWebhookDto } from './dto/cryndy-purchase-webhook.dto';
import { CryndyWebhookSignatureGuard } from './guards/cryndy-webhook-signature.guard';

// Server-to-server only — the presale site, not a logged-in NDY HUB user, is
// the caller. Auth is the HMAC signature checked by the guard, not a bearer
// token, so this deliberately does not sit behind JwtAuthGuard.
@Controller('webhooks/cryndy')
export class CryndyWebhookController {
  constructor(private readonly cryndy: CryndyService) {}

  @UseGuards(CryndyWebhookSignatureGuard)
  @Post('purchase')
  handlePurchaseWebhook(@Body() dto: CryndyPurchaseWebhookDto) {
    return this.cryndy.handlePurchaseWebhook(dto);
  }
}
