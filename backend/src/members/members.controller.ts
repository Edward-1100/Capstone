import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { WorldRole } from '../common/decorators/world-role.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { InviteMemberDto } from './dto/invite-member.dto';
import { MemberRoleDto } from './dto/member-role.dto';
import { MembersService } from './members.service';

@Controller('worlds/:id')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get('members')
  @WorldRole('owner')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  list(@Param('id') id: string) {
    return this.members.list(id);
  }

  @Post('members')
  @WorldRole('owner')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  invite(@Param('id') id: string, @Req() req: any, @Body() dto: InviteMemberDto) {
    return this.members.invite(id, req.user.id, dto.username, dto.role);
  }

  @Patch('members/:userId')
  @WorldRole('owner')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  setRole(@Param('id') id: string, @Param('userId', ParseUUIDPipe) userId: string, @Body() dto: MemberRoleDto) {
    return this.members.setRole(id, userId, dto.role);
  }

  @Delete('members/:userId')
  @HttpCode(200)
  @WorldRole('owner')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  remove(@Param('id') id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.members.remove(id, userId);
  }

  @Delete('membership')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  leave(@Param('id') id: string, @Req() req: any) {
    return this.members.leave(id, req.user.id);
  }

  @Post('membership/accept')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  accept(@Param('id') id: string, @Req() req: any) {
    return this.members.accept(id, req.user.id);
  }

  @Post('membership/deny')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  deny(@Param('id') id: string, @Req() req: any) {
    return this.members.deny(id, req.user.id);
  }

  @Get('invite-links')
  @WorldRole('owner')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  listLinks(@Param('id') id: string) {
    return this.members.listLinks(id);
  }

  @Post('invite-links')
  @WorldRole('owner')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  createLink(@Param('id') id: string, @Req() req: any, @Body() dto: MemberRoleDto) {
    return this.members.createLink(id, req.user.id, dto.role);
  }

  @Delete('invite-links/:linkId')
  @HttpCode(200)
  @WorldRole('owner')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  revokeLink(@Param('id') id: string, @Param('linkId', ParseUUIDPipe) linkId: string) {
    return this.members.revokeLink(id, linkId);
  }
}
