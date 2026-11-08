import { Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MembersService } from './members.service';

@Controller('invites')
export class JoinController {
  constructor(private readonly members: MembersService) {}

  @Post(':token/join')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  join(@Param('token') token: string, @Req() req: any) {
    return this.members.join(token, req.user.id);
  }
}
