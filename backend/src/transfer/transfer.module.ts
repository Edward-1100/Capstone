import { Module } from '@nestjs/common';
import { TransferController } from './transfer.controller';
import { TransferExportService } from './transfer.export';
import { TransferImportService } from './transfer.import';

@Module({
  controllers: [TransferController],
  providers: [TransferExportService, TransferImportService],
})
export class TransferModule {}
