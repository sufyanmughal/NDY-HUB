import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { IdentityModule } from './identity/identity.module';
import { AuthModule } from './auth/auth.module';
import { CryndyModule } from './cryndy/cryndy.module';
import { NdybitsModule } from './ndybits/ndybits.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    IdentityModule,
    AuthModule,
    CryndyModule,
    NdybitsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
