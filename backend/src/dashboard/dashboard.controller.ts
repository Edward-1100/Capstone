import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { WorldRole } from '../common/decorators/world-role.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { DashboardItemsService } from './dashboard.items';
import { DashboardService } from './dashboard.service';
import { DashboardSettingsDto, ItemChangeDto, NewItemDto, SuggestionDto, SuggestionStatusDto } from './dto/dashboard.dto';

@Controller('worlds/:id/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService, private readonly items: DashboardItemsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  get(@Param('id') id: string, @Req() req: any) {
    return this.dashboard.get(id, req.user ? req.worldRole : null);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  @WorldRole('owner')
  stats(@Param('id') id: string) {
    return this.dashboard.stats(id);
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  @WorldRole('owner')
  getSettings(@Param('id') id: string) {
    return this.items.getSettings(id);
  }

  @Put('settings')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  @WorldRole('owner')
  updateSettings(@Param('id') id: string, @Body() dto: DashboardSettingsDto) {
    return this.items.updateSettings(id, dto);
  }

  @Post('featured')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  @WorldRole('editor')
  addFeatured(@Param('id') id: string, @Req() req: any, @Body() dto: NewItemDto) {
    return this.items.addFeatured(id, req.user.id, dto);
  }

  @Patch('featured/:itemId')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  @WorldRole('editor')
  changeFeatured(@Param('id') id: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: ItemChangeDto) {
    return this.items.changeFeatured(id, itemId, dto);
  }

  @Delete('featured/:itemId')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  @WorldRole('editor')
  removeFeatured(@Param('id') id: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.items.removeFeatured(id, itemId);
  }

  @Post('pinned')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  @WorldRole('editor')
  addPinned(@Param('id') id: string, @Req() req: any, @Body() dto: NewItemDto) {
    return this.items.addPinned(id, req.user.id, dto);
  }

  @Patch('pinned/:itemId')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  @WorldRole('editor')
  changePinned(@Param('id') id: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: ItemChangeDto) {
    return this.items.changePinned(id, itemId, dto);
  }

  @Delete('pinned/:itemId')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  @WorldRole('editor')
  removePinned(@Param('id') id: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.items.removePinned(id, itemId);
  }

  @Post('suggestions')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  createSuggestion(@Param('id') id: string, @Req() req: any, @Body() dto: SuggestionDto) {
    return this.items.createSuggestion(id, req.user.id, req.worldRole, dto.body, dto.entryId, dto.anonymous);
  }

  @Get('suggestions')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  listSuggestions(@Param('id') id: string, @Req() req: any, @Query('status') status?: string) {
    return this.items.listSuggestions(id, req.worldRole, status === 'closed');
  }

  @Patch('suggestions/:suggestionId')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  setSuggestionStatus(@Param('id') id: string, @Param('suggestionId', ParseUUIDPipe) suggestionId: string, @Req() req: any, @Body() dto: SuggestionStatusDto) {
    return this.items.setSuggestionStatus(id, req.worldRole, req.user.id, suggestionId, dto.status);
  }
}
