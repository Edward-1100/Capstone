import { Module } from '@nestjs/common';
import { EntryTypesController } from './entry-types.controller';
import { EntryTypesService } from './entry-types.service';
import { FieldsController } from './fields.controller';
import { FieldsService } from './fields.service';

@Module({
  controllers: [EntryTypesController, FieldsController],
  providers: [EntryTypesService, FieldsService],
  exports: [EntryTypesService],
})
export class EntryTypesModule {}
