import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { WorldRole } from '../common/decorators/world-role.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { CreateFieldDto } from './dto/create-field.dto';
import { DeleteFieldDto } from './dto/delete-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { FieldsService } from './fields.service';

@Controller('worlds/:id/entry-types/:typeId/fields')
export class FieldsController {
  constructor(private readonly fields: FieldsService) {}

  @Post()
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  create(@Param('id') id: string, @Param('typeId', ParseUUIDPipe) typeId: string, @Body() dto: CreateFieldDto) {
    return this.fields.create(id, typeId, dto);
  }

  @Patch(':fieldId')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  update(@Param('id') id: string, @Param('typeId', ParseUUIDPipe) typeId: string, @Param('fieldId', ParseUUIDPipe) fieldId: string, @Body() dto: UpdateFieldDto) {
    return this.fields.update(id, typeId, fieldId, dto);
  }

  @Delete(':fieldId')
  @HttpCode(200)
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  remove(@Param('id') id: string, @Param('typeId', ParseUUIDPipe) typeId: string, @Param('fieldId', ParseUUIDPipe) fieldId: string, @Body() dto: DeleteFieldDto) {
    return this.fields.remove(id, typeId, fieldId, dto);
  }
}
