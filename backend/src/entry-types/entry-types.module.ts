import { Module } from '@nestjs/common';
import { EntryTypesController } from './entry-types.controller';
import { EntryTypesService } from './entry-types.service';

@Module({
  controllers: [EntryTypesController],
  providers: [EntryTypesService],
  exports: [EntryTypesService],
})
export class EntryTypesModule {}
