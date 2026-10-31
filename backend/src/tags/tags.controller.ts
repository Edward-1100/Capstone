import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { WorldRole } from '../common/decorators/world-role.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { CreateTagDto } from './dto/create-tag.dto';
import { DeleteTagDto } from './dto/delete-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagsService } from './tags.service';

@Controller('worlds/:id')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get('tags')
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  list(@Param('id') id: string) {
    return this.tags.list(id);
  }

  @Post('tags')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  create(@Param('id') id: string, @Body() dto: CreateTagDto) {
    return this.tags.create(id, dto);
  }

  @Patch('tags/:tagId')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  update(@Param('id') id: string, @Param('tagId', ParseUUIDPipe) tagId: string, @Body() dto: UpdateTagDto) {
    return this.tags.update(id, tagId, dto);
  }

  @Delete('tags/:tagId')
  @HttpCode(200)
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  remove(@Param('id') id: string, @Param('tagId', ParseUUIDPipe) tagId: string, @Body() dto: DeleteTagDto) {
    return this.tags.remove(id, tagId, dto);
  }

  @Get('entries/:entryId/tags')
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  listForEntry(@Param('id') id: string, @Param('entryId', ParseUUIDPipe) entryId: string) {
    return this.tags.listForEntry(id, entryId);
  }

  @Put('entries/:entryId/tags/:tagId')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  addToEntry(@Param('id') id: string, @Param('entryId', ParseUUIDPipe) entryId: string, @Param('tagId', ParseUUIDPipe) tagId: string, @Req() req: any) {
    return this.tags.addToEntry(id, entryId, tagId, req.user.id);
  }

  @Delete('entries/:entryId/tags/:tagId')
  @HttpCode(200)
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  removeFromEntry(@Param('id') id: string, @Param('entryId', ParseUUIDPipe) entryId: string, @Param('tagId', ParseUUIDPipe) tagId: string, @Req() req: any) {
    return this.tags.removeFromEntry(id, entryId, tagId, req.user.id);
  }
}
