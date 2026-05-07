import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { WorkspaceService } from './workspace.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Workspace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  @ApiOperation({ summary: 'Get workspace settings' })
  getWorkspace(@CurrentUser() user: any) {
    return this.workspaceService.getWorkspace(user.tenantId);
  }

  @Put()
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Update workspace settings' })
  updateWorkspace(
    @CurrentUser() user: any,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaceService.updateWorkspace(user.tenantId, dto);
  }

  @Get('members')
  @ApiOperation({ summary: 'List all team members' })
  getMembers(@CurrentUser() user: any) {
    return this.workspaceService.getMembers(user.tenantId);
  }

  @Post('members/invite')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Invite a new team member' })
  inviteMember(
    @CurrentUser() user: any,
    @Body() dto: InviteMemberDto,
  ) {
    return this.workspaceService.inviteMember(user.tenantId, dto);
  }

  @Put('members/:id/role')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update member role (Super Admin only)' })
  updateMemberRole(
    @CurrentUser() user: any,
    @Param('id') memberId: string,
    @Body('role') role: string,
  ) {
    return this.workspaceService.updateMemberRole(
      user.tenantId,
      memberId,
      role,
      user.id,
    );
  }

  @Delete('members/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Remove a team member' })
  removeMember(
    @CurrentUser() user: any,
    @Param('id') memberId: string,
  ) {
    return this.workspaceService.removeMember(user.tenantId, memberId, user.id);
  }

  @Get('departments')
  @ApiOperation({ summary: 'List all departments' })
  getDepartments(@CurrentUser() user: any) {
    return this.workspaceService.getDepartments(user.tenantId);
  }

  @Post('departments')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Create a new department' })
  createDepartment(
    @CurrentUser() user: any,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.workspaceService.createDepartment(user.tenantId, dto);
  }

  @Delete('departments/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a department' })
  deleteDepartment(
    @CurrentUser() user: any,
    @Param('id') departmentId: string,
  ) {
    return this.workspaceService.deleteDepartment(user.tenantId, departmentId);
  }

  @Get('audit-log')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Get workspace activity log' })
  getAuditLog(@CurrentUser() user: any) {
    return this.workspaceService.getAuditLog(user.tenantId);
  }
}
