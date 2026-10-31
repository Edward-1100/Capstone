import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { WorldRole } from '../common/decorators/world-role.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { RelationshipsService } from './relationships.service';

@Controller('worlds/:id')
export class RelationshipsController {
  constructor(private readonly relationships: RelationshipsService) {}

  @Get('entries/:entryId/relationships')
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  listForEntry(@Param('id') id: string, @Param('entryId', ParseUUIDPipe) entryId: string) {
    return this.relationships.listForEntry(id, entryId);
  }

  @Post('relationships')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  create(@Param('id') id: string, @Req() req: any, @Body() dto: CreateRelationshipDto) {
    return this.relationships.create(id, req.user.id, dto);
  }

  @Delete('relationships/:relationshipId')
  @HttpCode(200)
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  remove(@Param('id') id: string, @Param('relationshipId', ParseUUIDPipe) relationshipId: string) {
    return this.relationships.remove(id, relationshipId);
  }
}
