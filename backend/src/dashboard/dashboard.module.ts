import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardItemsService } from './dashboard.items';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardItemsService],
})
export class DashboardModule {}
