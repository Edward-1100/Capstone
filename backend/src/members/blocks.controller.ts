import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BlocksService } from './blocks.service';
import { BlockDto } from './dto/block.dto';

@Controller('blocks')
@UseGuards(JwtAuthGuard)
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  @Get()
  list(@Req() req: any) {
    return this.blocks.list(req.user.id);
  }

  @Post()
  add(@Req() req: any, @Body() dto: BlockDto) {
    return this.blocks.add(req.user.id, dto.username);
  }

  @Delete(':userId')
  remove(@Req() req: any, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.blocks.remove(req.user.id, userId);
  }
}
