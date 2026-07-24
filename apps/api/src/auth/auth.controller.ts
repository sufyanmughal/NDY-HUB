import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CreateLoginRequestDto } from './dto/create-login-request.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    // TODO(milestone 1, next pass): issue a real session (access + refresh
    // token pair) here instead of just validating credentials.
    return this.auth.validateLogin(dto);
  }

  @Post('login-request')
  createLoginRequest(@Body() dto: CreateLoginRequestDto, @Req() req: Request) {
    // TODO: resolve requestingLocation from IP via a geo-IP lookup once one is wired in.
    return this.auth.createLoginRequest(dto, { ip: req.ip });
  }

  @Get('login-request/:token')
  getLoginRequestStatus(@Param('token') token: string) {
    // Desktop polls this (or, once the WebSocket gateway lands, subscribes
    // instead) waiting for status to flip to APPROVED or DENIED.
    return this.auth.getLoginRequestStatus(token);
  }

  @Post('login-request/:token/approve')
  approveLoginRequest(@Param('token') token: string, @Body('userId') userId: string) {
    // TODO: this must only be callable with a valid NDYAPPS session — swap
    // the userId body param for req.user.id once the NDYAPPS-session guard
    // exists (that's the piece the NDYAPPS developer's build depends on).
    return this.auth.approveLoginRequest(token, userId);
  }

  @Post('login-request/:token/deny')
  denyLoginRequest(@Param('token') token: string) {
    return this.auth.denyLoginRequest(token);
  }
}
