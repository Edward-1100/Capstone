import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { WorldRole } from '../common/decorators/world-role.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { DeleteEntryTypeDto } from './dto/delete-entry-type.dto';
import { EntryTypeDto } from './dto/entry-type.dto';
import { NestingDto } from './dto/nesting.dto';
import { EntryTypesService } from './entry-types.service';

@Controller('worlds/:id/entry-types')
export class EntryTypesController {
  constructor(private readonly types: EntryTypesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  list(@Param('id') id: string) {
    return this.types.list(id);
  }

  @Post()
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  create(@Param('id') id: string, @Body() dto: EntryTypeDto) {
    return this.types.create(id, dto);
  }

  @Patch(':typeId')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  update(@Param('id') id: string, @Param('typeId', ParseUUIDPipe) typeId: string, @Body() dto: EntryTypeDto) {
    return this.types.update(id, typeId, dto);
  }

  @Put(':typeId/nesting')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  setNesting(@Param('id') id: string, @Param('typeId', ParseUUIDPipe) typeId: string, @Body() dto: NestingDto) {
    return this.types.setNesting(id, typeId, dto);
  }

  @Delete(':typeId')
  @HttpCode(200)
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  remove(@Param('id') id: string, @Param('typeId', ParseUUIDPipe) typeId: string, @Body() dto: DeleteEntryTypeDto) {
    return this.types.remove(id, typeId, dto);
  }
}
