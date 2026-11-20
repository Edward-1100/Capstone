import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { GraphService } from './graph.service';

@Controller('worlds/:id/graph')
export class GraphController {
  constructor(private readonly graph: GraphService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard, WorldRoleGuard)
  get(@Param('id') id: string) {
    return this.graph.get(id);
  }
}
