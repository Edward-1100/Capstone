import { Module } from '@nestjs/common';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';
import { JoinController } from './join.controller';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  controllers: [MembersController, JoinController, BlocksController],
  providers: [MembersService, BlocksService],
})
export class MembersModule {}
