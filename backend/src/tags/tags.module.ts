import { Module } from '@nestjs/common';
import { TagRulesController } from './tag-rules.controller';
import { TagRulesService } from './tag-rules.service';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  controllers: [TagsController, TagRulesController],
  providers: [TagsService, TagRulesService],
})
export class TagsModule {}
