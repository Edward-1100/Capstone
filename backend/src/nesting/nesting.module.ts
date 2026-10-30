import { Global, Module } from '@nestjs/common';
import { NestingService } from './nesting.service';

@Global()
@Module({
  providers: [NestingService],
  exports: [NestingService],
})
export class NestingModule {}
