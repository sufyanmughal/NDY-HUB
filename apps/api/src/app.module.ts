import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { IdentityModule } from './identity/identity.module';
import { AuthModule } from './auth/auth.module';
import { CryndyModule } from './cryndy/cryndy.module';
import { NdybitsModule } from './ndybits/ndybits.module';
import { MembershipModule } from './membership/membership.module';
import { SecurityModule } from './security/security.module';
import { TransactionsModule } from './transactions/transactions.module';
import { DocumentsModule } from './documents/documents.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Applies to every route by default (100 req/min/IP) unless a specific
    // controller method overrides it with @Throttle() — see auth.controller.ts
    // for the tighter limits on login/register/change-password, the actual
    // brute-force targets. Named 'default' so per-route @Throttle({ default: ... })
    // overrides know which throttler they're tightening.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    PrismaModule,
    IdentityModule,
    AuthModule,
    CryndyModule,
    NdybitsModule,
    MembershipModule,
    SecurityModule,
    TransactionsModule,
    DocumentsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
