import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WorldRole } from '../common/decorators/world-role.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { EntriesService } from './entries.service';

@Controller('worlds/:id/entries')
export class EntriesController {
  constructor(private readonly entries: EntriesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  list(@Param('id') id: string, @Query('typeId') typeId?: string) {
    return this.entries.list(id, typeId);
  }

  @Post()
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  create(@Param('id') id: string, @Req() req: any, @Body() dto: CreateEntryDto) {
    return this.entries.create(id, req.user.id, dto);
  }

  @Get(':entryId')
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  findOne(@Param('id') id: string, @Param('entryId', ParseUUIDPipe) entryId: string) {
    return this.entries.findOne(id, entryId);
  }

  @Patch(':entryId')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  update(@Param('id') id: string, @Param('entryId', ParseUUIDPipe) entryId: string, @Req() req: any, @Body() dto: UpdateEntryDto) {
    return this.entries.update(id, entryId, req.user.id, dto);
  }

  @Delete(':entryId')
  @HttpCode(200)
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  remove(@Param('id') id: string, @Param('entryId', ParseUUIDPipe) entryId: string, @Req() req: any) {
    return this.entries.remove(id, entryId, req.user.id);
  }

  @Post(':entryId/images')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  @UseInterceptors(FileInterceptor('file', {limits: {fileSize: 5 * 1024 * 1024, files: 1}}))
  addImage(@Param('id') id: string, @Param('entryId', ParseUUIDPipe) entryId: string, @Req() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.entries.addImage(id, entryId, req.user.id, file);
  }

  @Put(':entryId/images/:imageId')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  @UseInterceptors(FileInterceptor('file', {limits: {fileSize: 5 * 1024 * 1024, files: 1}}))
  replaceImage(@Param('id') id: string, @Param('entryId', ParseUUIDPipe) entryId: string, @Param('imageId', ParseUUIDPipe) imageId: string, @Req() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.entries.replaceImage(id, entryId, imageId, req.user.id, file);
  }

  @Delete(':entryId/images/:imageId')
  @HttpCode(200)
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  removeImage(@Param('id') id: string, @Param('entryId', ParseUUIDPipe) entryId: string, @Param('imageId', ParseUUIDPipe) imageId: string, @Req() req: any) {
    return this.entries.removeImage(id, entryId, imageId, req.user.id);
  }
}
