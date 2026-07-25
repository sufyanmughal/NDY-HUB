import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // for JwtAuthGuard on TransactionsController
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
