import { IsIn, IsNumberString } from 'class-validator';

const DIRECTIONS = ['NDYBITS_TO_CRYNDY', 'CRYNDY_TO_NDYX'] as const;

export class CheckEligibilityDto {
  @IsIn(DIRECTIONS)
  direction!: (typeof DIRECTIONS)[number];

  @IsNumberString()
  sourceAmount!: string;
}
