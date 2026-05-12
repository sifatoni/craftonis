import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { CreateInterviewDto } from './dto/create-interview.dto'
import { SubmitRatingsDto } from './dto/submit-ratings.dto'

@Injectable()
export class InterviewsService {
  constructor(private prisma: PrismaService) {}

  async getInterviews(tenantId: string, filters?: { candidateId?: string; status?: string }) {
    const where: any = { candidate: { tenantId } }
    if (filters?.candidateId) where.candidateId = filters.candidateId
    if (filters?.status) where.status = filters.status

    return this.prisma.interview.findMany({
      where,
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
            stage: true,
            job: { select: { id: true, title: true } },
            cvScore: { select: { totalScore: true, parsedData: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    })
  }

  async getInterview(tenantId: string, interviewId: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, candidate: { tenantId } },
      include: {
        candidate: {
          include: {
            job: { select: { id: true, title: true, description: true, requirements: true } },
            cvScore: true,
          },
        },
      },
    })
    if (!interview) throw new NotFoundException('Interview not found')
    return interview
  }

  async createInterview(tenantId: string, dto: CreateInterviewDto, interviewerId: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: dto.candidateId, tenantId },
    })
    if (!candidate) throw new NotFoundException('Candidate not found')

    const interview = await this.prisma.interview.create({
      data: {
        candidateId: dto.candidateId,
        interviewerId,
        type: dto.type,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: 'SCHEDULED',
        notes: dto.notes,
      },
      include: {
        candidate: { select: { id: true, name: true, email: true } },
      },
    })

    // Move candidate to INTERVIEW stage
    await this.prisma.candidate.update({
      where: { id: dto.candidateId },
      data: { stage: 'INTERVIEW' },
    })

    return interview
  }

  async startInterview(tenantId: string, interviewId: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, candidate: { tenantId } },
    })
    if (!interview) throw new NotFoundException('Interview not found')

    return this.prisma.interview.update({
      where: { id: interviewId },
      data: { status: 'IN_PROGRESS' },
    })
  }

  async submitRatings(tenantId: string, interviewId: string, dto: SubmitRatingsDto) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, candidate: { tenantId } },
    })
    if (!interview) throw new NotFoundException('Interview not found')

    const updated = await this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        ratings: dto.ratings,
        notes: dto.notes || interview.notes,
        status: 'COMPLETED',
      },
    })

    return updated
  }

  async cancelInterview(tenantId: string, interviewId: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, candidate: { tenantId } },
    })
    if (!interview) throw new NotFoundException('Interview not found')

    return this.prisma.interview.update({
      where: { id: interviewId },
      data: { status: 'CANCELLED' },
    })
  }

  async getQuestions(type: string, department?: string) {
    // Return built-in question bank
    const behavioral = [
      { id: 'b1', category: 'Leadership', question: 'Tell me about a time you led a team through a difficult situation.' },
      { id: 'b2', category: 'Communication', question: 'Describe a situation where you had to explain a complex idea to a non-technical audience.' },
      { id: 'b3', category: 'Problem Solving', question: 'Give an example of a problem you solved in an innovative way.' },
      { id: 'b4', category: 'Cultural Fit', question: 'What does a positive work environment mean to you?' },
      { id: 'b5', category: 'Leadership', question: 'How do you prioritize tasks when everything seems urgent?' },
      { id: 'b6', category: 'Communication', question: 'Describe a time when you had a conflict with a colleague. How did you resolve it?' },
      { id: 'b7', category: 'Problem Solving', question: 'Tell me about a time you failed. What did you learn from it?' },
      { id: 'b8', category: 'Cultural Fit', question: 'Where do you see yourself in 5 years?' },
    ]

    const technical = [
      { id: 't1', category: 'Data Structures', question: 'Implement a function to reverse a linked list.', starterCode: 'function reverseList(head) {\n  // your code here\n}' },
      { id: 't2', category: 'Algorithms', question: 'Write a function to find the two numbers in an array that add up to a target sum.', starterCode: 'function twoSum(nums, target) {\n  // your code here\n}' },
      { id: 't3', category: 'System Design', question: 'Design a URL shortener system. Describe the architecture.', starterCode: '// Describe your architecture in comments\n// Think about: storage, hashing, scaling\n' },
      { id: 't4', category: 'Algorithms', question: 'Implement binary search on a sorted array.', starterCode: 'function binarySearch(arr, target) {\n  // your code here\n}' },
      { id: 't5', category: 'Data Structures', question: 'Implement a stack using two queues.', starterCode: 'class Stack {\n  // your code here\n}' },
    ]

    return type === 'TECHNICAL' ? technical : behavioral
  }
}
