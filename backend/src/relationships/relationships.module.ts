import { Global, Module } from '@nestjs/common';
import { RelationshipTypesController } from './relationship-types.controller';
import { RelationshipTypesService } from './relationship-types.service';
import { RelationshipsController } from './relationships.controller';
import { RelationshipsService } from './relationships.service';

@Global()
@Module({
  controllers: [RelationshipTypesController, RelationshipsController],
  providers: [RelationshipTypesService, RelationshipsService],
  exports: [RelationshipsService],
})
export class RelationshipsModule {}
