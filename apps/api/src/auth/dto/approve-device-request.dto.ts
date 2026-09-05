import { IsString, Length } from 'class-validator';

export class ApproveDeviceRequestDto {
  // Exactly 3 digits, matching DeviceApprovalRequest.matchCode's own
  // format — validated as a string, not a number, so a leading zero
  // (e.g. "042") round-trips correctly rather than becoming ambiguous.
  @IsString()
  @Length(3, 3)
  matchCode!: string;
}
