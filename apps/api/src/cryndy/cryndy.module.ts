import { Module } from '@nestjs/common';
import { CryndyService } from './cryndy.service';
import { CryndyController } from './cryndy.controller';
import { CryndyWebhookController } from './cryndy-webhook.controller';
import { CryndyWebhookSignatureGuard } from './guards/cryndy-webhook-signature.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // for JwtAuthGuard on CryndyController
  controllers: [CryndyController, CryndyWebhookController],
  providers: [CryndyService, CryndyWebhookSignatureGuard],
  exports: [CryndyService],
})
export class CryndyModule {}
