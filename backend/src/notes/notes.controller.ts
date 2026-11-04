import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { WorldRole } from '../common/decorators/world-role.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { NoteDto } from './dto/note.dto';
import { NotesService } from './notes.service';

@Controller('worlds/:id')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get('entries/:entryId/notes')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  list(@Param('id') id: string, @Param('entryId', ParseUUIDPipe) entryId: string) {
    return this.notes.list(id, entryId);
  }

  @Post('entries/:entryId/notes')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  create(@Param('id') id: string, @Param('entryId', ParseUUIDPipe) entryId: string, @Req() req: any, @Body() dto: NoteDto) {
    return this.notes.create(id, entryId, req.user.id, dto);
  }

  @Patch('notes/:noteId')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  update(@Param('id') id: string, @Param('noteId', ParseUUIDPipe) noteId: string, @Req() req: any, @Body() dto: NoteDto) {
    return this.notes.update(id, noteId, req.user.id, dto);
  }

  @Delete('notes/:noteId')
  @HttpCode(200)
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  remove(@Param('id') id: string, @Param('noteId', ParseUUIDPipe) noteId: string, @Req() req: any) {
    return this.notes.remove(id, noteId, req.user.id, req.worldRole);
  }
}
