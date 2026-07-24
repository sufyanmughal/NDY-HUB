import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionService } from './session.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginRequestGateway } from './login-request.gateway';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    IdentityModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionService, JwtAuthGuard, LoginRequestGateway],
})
export class AuthModule {}
