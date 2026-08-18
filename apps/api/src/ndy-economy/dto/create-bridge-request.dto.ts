import { IsIn, IsNumberString } from 'class-validator';

const DIRECTIONS = ['NDYBITS_TO_CRYNDY', 'CRYNDY_TO_NDYX'] as const;

export class CreateBridgeRequestDto {
  @IsIn(DIRECTIONS)
  direction!: (typeof DIRECTIONS)[number];

  // A decimal amount as a string (not number) — avoids float-precision
  // loss on values that ultimately back a Decimal(28,8) column, same
  // reasoning as CryndyPurchase.cryndyAmount's own Decimal typing.
  @IsNumberString()
  sourceAmount!: string;
}
