import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { GdprService } from './gdpr.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('gdpr')
export class GdprController {
  constructor(private readonly gdpr: GdprService) {}

  @Get('export')
  async export(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.gdpr.exportUserData(user.sub);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ndyhub-data-export-${user.ndyId}.json"`,
    );
    return data;
  }

  @Post('delete-account')
  deleteAccount(
    @Body() dto: DeleteAccountDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.gdpr.deleteAccount(user.sub, dto);
  }
}
