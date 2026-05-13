import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Role, InterviewType } from '@prisma/client'
import { QuestionsService } from './questions.service'
import { CreateQuestionDto } from './dto/create-question.dto'
import { UpdateQuestionDto } from './dto/update-question.dto'
import { ReorderQuestionsDto } from './dto/reorder-questions.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'

@ApiTags('Questions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  @ApiOperation({ summary: 'List active questions, optionally filtered by type' })
  getQuestions(
    @CurrentUser() user: any,
    @Query('type') type?: InterviewType,
  ) {
    return this.questionsService.getQuestions(user.tenantId, type)
  }

  @Post('reorder')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Reorder questions' })
  reorderQuestions(@CurrentUser() user: any, @Body() dto: ReorderQuestionsDto) {
    return this.questionsService.reorderQuestions(user.tenantId, dto)
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Create a new question' })
  createQuestion(@CurrentUser() user: any, @Body() dto: CreateQuestionDto) {
    return this.questionsService.createQuestion(user.tenantId, dto)
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Update a question' })
  updateQuestion(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionsService.updateQuestion(user.tenantId, id, dto)
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Soft-delete a question' })
  deleteQuestion(@CurrentUser() user: any, @Param('id') id: string) {
    return this.questionsService.deleteQuestion(user.tenantId, id)
  }
}
