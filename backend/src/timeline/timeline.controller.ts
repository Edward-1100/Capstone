import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { WorldRole } from '../common/decorators/world-role.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { CreateTimelineEntryDto } from './dto/create-timeline-entry.dto';
import { TimelineColorDto } from './dto/timeline-color.dto';
import { UpdateTimelineEntryDto } from './dto/update-timeline-entry.dto';
import { TimelineService } from './timeline.service';

@Controller('worlds/:id/timeline')
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  list(@Param('id') id: string) {
    return this.timeline.list(id);
  }

  @Post()
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  create(@Param('id') id: string, @Req() req: any, @Body() dto: CreateTimelineEntryDto) {
    return this.timeline.create(id, req.user.id, dto);
  }

  @Patch(':itemId')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  update(@Param('id') id: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: UpdateTimelineEntryDto) {
    return this.timeline.update(id, itemId, dto);
  }

  @Put(':itemId/color')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  setColor(@Param('id') id: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: TimelineColorDto) {
    return this.timeline.setColor(id, itemId, dto);
  }

  @Delete(':itemId')
  @HttpCode(200)
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  remove(@Param('id') id: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.timeline.remove(id, itemId);
  }
}
