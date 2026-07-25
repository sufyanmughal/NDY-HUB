import { Controller, Get, Header, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('me')
  list(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.documents.listMyDocuments(user.sub);
  }

  @Get(':id/download')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { filename, content } = await this.documents.renderDocument(
      user.sub,
      id,
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return content;
  }
}
