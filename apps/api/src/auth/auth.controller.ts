import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CreateLoginRequestDto } from './dto/create-login-request.dto';
import { RefreshDto } from './dto/refresh.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from './guards/jwt-auth.guard';
import type { SessionMeta } from './session.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, sessionMeta(req));
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, sessionMeta(req));
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, sessionMeta(req));
  }

  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Post('login-request')
  createLoginRequest(@Body() dto: CreateLoginRequestDto, @Req() req: Request) {
    // TODO: resolve requestingLocation from IP via a geo-IP lookup once one is wired in.
    return this.auth.createLoginRequest(dto, { ip: req.ip });
  }

  @Get('login-request/:token')
  getLoginRequestStatus(@Param('token') token: string) {
    // Desktop can poll this as a fallback, but should prefer subscribing to
    // the "login-request:status" WebSocket event for the same token.
    return this.auth.getLoginRequestStatus(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('login-request/:token/approve')
  approveLoginRequest(
    @Param('token') token: string,
    @CurrentUser() user: { sub: string },
  ) {
    // Requires a valid NDYAPPS access token — this is the piece the
    // NDYAPPS developer's build authenticates against before calling here.
    return this.auth.approveLoginRequest(token, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('login-request/:token/deny')
  denyLoginRequest(@Param('token') token: string) {
    return this.auth.denyLoginRequest(token);
  }

  @Post('login-request/:token/exchange')
  exchangeLoginRequest(@Param('token') token: string, @Req() req: Request) {
    // Called by the desktop browser once it sees the request go APPROVED —
    // trades the one-time approval for a real access/refresh session pair.
    return this.auth.exchangeLoginRequest(token, sessionMeta(req));
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.auth.getMe(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.auth.updateProfile(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.auth.changePassword(user.sub, dto);
  }
}

function sessionMeta(req: Request): SessionMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
