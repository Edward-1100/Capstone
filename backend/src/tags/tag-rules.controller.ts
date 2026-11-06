import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { WorldRole } from '../common/decorators/world-role.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { RuleEntryDto } from './dto/rule-entry.dto';
import { SaveRuleDto } from './dto/save-rule.dto';
import { TagRulesService } from './tag-rules.service';

@Controller('worlds/:id/tags/:tagId/rule')
export class TagRulesController {
  constructor(private readonly rules: TagRulesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  get(@Param('id') id: string, @Param('tagId', ParseUUIDPipe) tagId: string) {
    return this.rules.get(id, tagId);
  }

  @Put()
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  save(@Param('id') id: string, @Param('tagId', ParseUUIDPipe) tagId: string, @Body() dto: SaveRuleDto) {
    return this.rules.save(id, tagId, dto);
  }

  @Get('entries')
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  preview(@Param('id') id: string, @Param('tagId', ParseUUIDPipe) tagId: string) {
    return this.rules.preview(id, tagId);
  }

  @Put('entries/:entryId')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  setEntry(@Param('id') id: string, @Param('tagId', ParseUUIDPipe) tagId: string, @Param('entryId', ParseUUIDPipe) entryId: string, @Body() dto: RuleEntryDto) {
    return this.rules.setEntry(id, tagId, entryId, dto.exclude);
  }

  @Delete('entries/:entryId')
  @HttpCode(200)
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  clearEntry(@Param('id') id: string, @Param('tagId', ParseUUIDPipe) tagId: string, @Param('entryId', ParseUUIDPipe) entryId: string) {
    return this.rules.clearEntry(id, tagId, entryId);
  }
}
