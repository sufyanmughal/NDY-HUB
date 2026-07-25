import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OAuthClientService } from './oauth-client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { ALL_SCOPES, OIDC_SCOPES } from './scopes';

// "Manage website integrations" from the admin dashboard requirements —
// this is where a connected NDJOYIT site gets registered as an OAuth
// client, with the redirect URIs and scopes it's allowed to request.
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/oauth-clients')
export class OAuthClientAdminController {
  constructor(private readonly clients: OAuthClientService) {}

  @Get('scopes')
  listScopes() {
    return { scopes: OIDC_SCOPES, all: ALL_SCOPES };
  }

  @Get()
  list() {
    return this.clients.list();
  }

  @Post()
  create(@Body() dto: CreateClientDto) {
    // Returns the plaintext client secret — the one and only time it's ever
    // visible. The admin panel needs to show it once and tell the operator
    // to copy it now.
    return this.clients.create(dto);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.clients.setActive(id, true);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.clients.setActive(id, false);
  }
}
