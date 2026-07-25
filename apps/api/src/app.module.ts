import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
  providers: [AppService],
})
export class AppModule {}
