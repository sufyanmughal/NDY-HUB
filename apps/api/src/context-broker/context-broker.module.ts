import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContextBrokerService } from './context-broker.service';
import { ContextBrokerController } from './context-broker.controller';

/**
 * Context Broker — the AI external-service permission layer.
 *
 * Exports ContextBrokerService so ActionEngineModule can call assertConsent()
 * from its existing Authorize step. AuthModule is imported for JwtAuthGuard on
 * the consent-management controller, same as every other guarded feature
 * module here.
 */
@Module({
  imports: [AuthModule],
  controllers: [ContextBrokerController],
  providers: [ContextBrokerService],
  exports: [ContextBrokerService],
})
export class ContextBrokerModule {}
