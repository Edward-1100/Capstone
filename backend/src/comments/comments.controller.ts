import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { WorldRole } from '../common/decorators/world-role.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { CommentsService } from './comments.service';
import { CommentDto } from './dto/comment.dto';

@Controller('worlds/:id')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('entries/:entryId/comments')
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  list(@Param('id') id: string, @Param('entryId', ParseUUIDPipe) entryId: string) {
    return this.comments.list(id, entryId);
  }

  @Post('entries/:entryId/comments')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  create(@Param('id') id: string, @Param('entryId', ParseUUIDPipe) entryId: string, @Req() req: any, @Body() dto: CommentDto) {
    return this.comments.create(id, entryId, req.user.id, dto);
  }

  @Patch('comments/:commentId')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  update(@Param('id') id: string, @Param('commentId', ParseUUIDPipe) commentId: string, @Req() req: any, @Body() dto: CommentDto) {
    return this.comments.update(id, commentId, req.user.id, dto);
  }

  @Delete('comments/:commentId')
  @HttpCode(200)
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  remove(@Param('id') id: string, @Param('commentId', ParseUUIDPipe) commentId: string, @Req() req: any) {
    return this.comments.remove(id, commentId, req.user.id, req.worldRole);
  }
}
