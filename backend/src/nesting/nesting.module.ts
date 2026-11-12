import { Global, Module } from '@nestjs/common';
import { NestingController } from './nesting.controller';
import { NestingService } from './nesting.service';

@Global()
@Module({
  controllers: [NestingController],
  providers: [NestingService],
  exports: [NestingService],
})
export class NestingModule {}
