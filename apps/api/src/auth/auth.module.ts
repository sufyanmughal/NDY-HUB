import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionService } from './session.service';
import { TotpService } from './totp.service';
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
  providers: [
    AuthService,
    SessionService,
    TotpService,
    JwtAuthGuard,
    LoginRequestGateway,
  ],
  // JwtModule (for JwtService) and JwtAuthGuard itself need to be visible to
  // any other module that guards a route with @UseGuards(JwtAuthGuard) —
  // without this, Nest can resolve JwtAuthGuard's class but not its
  // JwtService constructor dependency, and refuses to boot.
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
