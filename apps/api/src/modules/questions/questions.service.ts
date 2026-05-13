import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { CreateQuestionDto } from './dto/create-question.dto'
import { UpdateQuestionDto } from './dto/update-question.dto'
import { ReorderQuestionsDto } from './dto/reorder-questions.dto'
import { InterviewType } from '@prisma/client'

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  async getQuestions(tenantId: string, type?: InterviewType) {
    return this.prisma.question.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(type ? { type } : {}),
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async createQuestion(tenantId: string, dto: CreateQuestionDto) {
    const maxOrder = await this.prisma.question.aggregate({
      where: { tenantId, type: dto.type, isActive: true },
      _max: { order: true },
    })
    const nextOrder = dto.order ?? (maxOrder._max.order ?? -1) + 1

    return this.prisma.question.create({
      data: {
        tenantId,
        type: dto.type,
        text: dto.text,
        category: dto.category,
        order: nextOrder,
        isCustom: true,
      },
    })
  }

  async updateQuestion(tenantId: string, id: string, dto: UpdateQuestionDto) {
    const question = await this.prisma.question.findFirst({
      where: { id, tenantId, isActive: true },
    })
    if (!question) throw new NotFoundException('Question not found')

    return this.prisma.question.update({
      where: { id },
      data: {
        ...(dto.text !== undefined && { text: dto.text }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    })
  }

  async deleteQuestion(tenantId: string, id: string) {
    const question = await this.prisma.question.findFirst({
      where: { id, tenantId, isActive: true },
    })
    if (!question) throw new NotFoundException('Question not found')

    await this.prisma.question.update({
      where: { id },
      data: { isActive: false },
    })
    return { success: true }
  }

  async reorderQuestions(tenantId: string, dto: ReorderQuestionsDto) {
    const ids = dto.updates.map(u => u.id)
    const existing = await this.prisma.question.findMany({
      where: { id: { in: ids }, tenantId, isActive: true },
      select: { id: true },
    })
    const validIds = new Set(existing.map(q => q.id))

    await this.prisma.$transaction(
      dto.updates
        .filter(u => validIds.has(u.id))
        .map(u =>
          this.prisma.question.update({
            where: { id: u.id },
            data: { order: u.order },
          }),
        ),
    )

    return { success: true }
  }
}
