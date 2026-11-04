import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { WorldRole } from '../common/decorators/world-role.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { CreateRelationshipTypeDto } from './dto/create-relationship-type.dto';
import { DeleteRelationshipTypeDto } from './dto/delete-relationship-type.dto';
import { UpdateRelationshipTypeDto } from './dto/update-relationship-type.dto';
import { RelationshipTypesService } from './relationship-types.service';

@Controller('worlds/:id/relationship-types')
export class RelationshipTypesController {
  constructor(private readonly types: RelationshipTypesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  list(@Param('id') id: string) {
    return this.types.list(id);
  }

  @Post()
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  create(@Param('id') id: string, @Body() dto: CreateRelationshipTypeDto) {
    return this.types.create(id, dto);
  }

  @Patch(':typeId')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  update(@Param('id') id: string, @Param('typeId', ParseUUIDPipe) typeId: string, @Body() dto: UpdateRelationshipTypeDto) {
    return this.types.update(id, typeId, dto);
  }

  @Delete(':typeId')
  @HttpCode(200)
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  remove(@Param('id') id: string, @Param('typeId', ParseUUIDPipe) typeId: string, @Body() dto: DeleteRelationshipTypeDto) {
    return this.types.remove(id, typeId, dto);
  }
}
