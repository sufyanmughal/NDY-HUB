import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { InternalSecretGuard } from './guards/internal-secret.guard';
import { BackupAlertService } from './backup-alert.service';

class BackupAlertDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsNotEmpty()
  stamp!: string;
}

/**
 * The receiving end of deploy/backup.sh's notify_failure() — see
 * InternalSecretGuard's doc comment for why this isn't behind
 * JwtAuthGuard. A failed/truncated nightly backup used to be silent (a
 * real ~800-byte empty dump sat unnoticed in production for 12 days) —
 * this is what makes it a real, delivered alert instead, per the client's
 * explicit "treat backup storage as urgent" instruction.
 */
@UseGuards(InternalSecretGuard)
@Controller('internal')
export class BackupAlertController {
  constructor(private readonly backupAlerts: BackupAlertService) {}

  @Post('backup-alert')
  async backupAlert(@Body() dto: BackupAlertDto) {
    await this.backupAlerts.notifyAdmins(dto.reason, dto.stamp);
    return { delivered: true };
  }
}
