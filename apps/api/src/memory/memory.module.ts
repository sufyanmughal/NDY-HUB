import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';

/**
 * NDYRA Phase 1 — user-controlled personal memory. AuthModule provides
 * JwtAuthGuard. MemoryService is exported so NDYCORE's eventual API client
 * (or any future same-process consumer) can read it without a duplicate
 * service — but nothing in this codebase calls it directly yet; NDYCORE is
 * a separate product and will reach this through the HTTP API, same as
 * every other relying party.
 */
@Module({
  imports: [AuthModule],
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
