import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WorldRole } from '../common/decorators/world-role.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { CreateMapDto } from './dto/create-map.dto';
import { CreateMarkerDto } from './dto/create-marker.dto';
import { DeleteMapDto } from './dto/delete-map.dto';
import { UpdateMarkerDto } from './dto/update-marker.dto';
import { MapsService } from './maps.service';

@Controller('worlds/:id')
export class MapsController {
  constructor(private readonly maps: MapsService) {}

  @Get('maps')
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  list(@Param('id') id: string) {
    return this.maps.list(id);
  }

  @Post('maps')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  @UseInterceptors(FileInterceptor('file', {limits: {fileSize: 100 * 1024 * 1024, files: 1}}))
  create(@Param('id') id: string, @Req() req: any, @Body() dto: CreateMapDto, @UploadedFile() file: Express.Multer.File) {
    return this.maps.create(id, req.user.id, dto.name, file);
  }

  @Get('maps/:mapId')
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  findOne(@Param('id') id: string, @Param('mapId', ParseUUIDPipe) mapId: string) {
    return this.maps.findOne(id, mapId);
  }

  @Patch('maps/:mapId')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  rename(@Param('id') id: string, @Param('mapId', ParseUUIDPipe) mapId: string, @Body() dto: CreateMapDto) {
    return this.maps.rename(id, mapId, dto.name);
  }

  @Delete('maps/:mapId')
  @HttpCode(200)
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  remove(@Param('id') id: string, @Param('mapId', ParseUUIDPipe) mapId: string, @Body() dto: DeleteMapDto) {
    return this.maps.remove(id, mapId, dto.confirmName);
  }

  @Post('maps/:mapId/markers')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  createMarker(@Param('id') id: string, @Param('mapId', ParseUUIDPipe) mapId: string, @Req() req: any, @Body() dto: CreateMarkerDto) {
    return this.maps.createMarker(id, mapId, req.user.id, dto);
  }

  @Patch('markers/:markerId')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  updateMarker(@Param('id') id: string, @Param('markerId', ParseUUIDPipe) markerId: string, @Body() dto: UpdateMarkerDto) {
    return this.maps.updateMarker(id, markerId, dto);
  }

  @Delete('markers/:markerId')
  @HttpCode(200)
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  removeMarker(@Param('id') id: string, @Param('markerId', ParseUUIDPipe) markerId: string) {
    return this.maps.removeMarker(id, markerId);
  }
}
