import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { DatabaseService } from '../database/database.service';
import { NestingService } from './nesting.service';

@Controller('worlds/:id/entries/:entryId/ancestors')
export class NestingController {
  constructor(private readonly nesting: NestingService, private readonly db: DatabaseService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  ancestors(@Param('id') id: string, @Param('entryId', ParseUUIDPipe) entryId: string) {
    return this.nesting.ancestors(this.db, id, entryId);
  }
}
