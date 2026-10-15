import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { WorldRole } from '../common/decorators/world-role.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { CreateWorldDto } from './dto/create-world.dto';
import { DeleteWorldDto } from './dto/delete-world.dto';
import { UpdateWorldDto } from './dto/update-world.dto';
import { WorldsService } from './worlds.service';

@Controller('worlds')
export class WorldsController {
  constructor(private readonly worlds: WorldsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() dto: CreateWorldDto) {
    return this.worlds.create(req.user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Req() req: any) {
    return this.worlds.listForUser(req.user.id);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.worlds.findOne(id, req.worldRole);
  }

  @Patch(':id')
  @WorldRole('owner')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  update(@Param('id') id: string, @Body() dto: UpdateWorldDto) {
    return this.worlds.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @WorldRole('owner')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  remove(@Param('id') id: string, @Body() dto: DeleteWorldDto) {
    return this.worlds.remove(id, dto.confirmName);
  }
}
