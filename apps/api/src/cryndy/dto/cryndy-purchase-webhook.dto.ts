import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { CryndyPurchaseStatus } from '@prisma/client';

// What the presale site posts once a payment event happens on its side.
// `status` is the stage the presale itself has reached for this transaction
// (its own review/KYC pipeline runs there, not here) — see CryndyService for
// how a single webhook call walks a fresh purchase forward through that
// reported stage.
export class CryndyPurchaseWebhookDto {
  @IsString()
  providerTransactionId!: string;

  @IsString()
  ndyId!: string;

  @IsEnum(CryndyPurchaseStatus)
  status!: CryndyPurchaseStatus;

  @IsNumber()
  @IsPositive()
  amountPaid!: number;

  @IsString()
  currency!: string;

  @IsNumber()
  @IsPositive()
  cryndyAmount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusAmount?: number;

  @IsOptional()
  @IsString()
  packageName?: string;

  @IsString()
  paymentMethod!: string;
}
