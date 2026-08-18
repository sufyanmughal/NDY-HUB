import { IsBoolean } from 'class-validator';

export class ResolveApprovalDto {
  @IsBoolean()
  approve!: boolean;
}
