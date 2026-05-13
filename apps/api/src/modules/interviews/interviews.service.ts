import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { CreateInterviewDto } from './dto/create-interview.dto'
import { UpdateInterviewDto } from './dto/update-interview.dto'
import { SubmitRatingsDto } from './dto/submit-ratings.dto'
import { sendInterviewScheduledEmail } from '../../services/email.service'

const CANDIDATE_SELECT = {
  id: true,
  name: true,
  email: true,
  stage: true,
  job: { select: { id: true, title: true } },
  cvScore: { select: { totalScore: true, parsedData: true } },
}

@Injectable()
export class InterviewsService {
  constructor(private prisma: PrismaService) {}

  async getInterviews(tenantId: string, filters?: { candidateId?: string; status?: string }) {
    const where: any = { candidate: { tenantId } }
    if (filters?.candidateId) where.candidateId = filters.candidateId
    if (filters?.status) where.status = filters.status

    return this.prisma.interview.findMany({
      where,
      include: { candidate: { select: CANDIDATE_SELECT } },
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

    // Resolve jobId: prefer explicit, fall back to candidate's job
    const jobId = dto.jobId ?? candidate.jobId ?? undefined

    // Cast to any so jobId is accepted before the Prisma client regenerates
    const createData: any = {
      candidateId: dto.candidateId,
      interviewerId,
      jobId,
      type: dto.type,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      status: 'SCHEDULED',
      notes: dto.notes,
    }

    const interview = await this.prisma.interview.create({
      data: createData,
      include: { candidate: { select: { id: true, name: true, email: true } } },
    })

    await this.prisma.candidate.update({
      where: { id: dto.candidateId },
      data: { stage: 'INTERVIEW' },
    })

    if (interview.scheduledAt) {
      try {
        const [tenant, interviewer] = await Promise.all([
          this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
          this.prisma.user.findUnique({ where: { id: interviewerId }, select: { name: true } }),
        ])
        await sendInterviewScheduledEmail({
          candidateEmail: candidate.email,
          candidateName: candidate.name,
          companyName: tenant?.name || 'Craftonis',
          interviewType: interview.type,
          scheduledAt: interview.scheduledAt,
          notes: interview.notes || undefined,
          interviewerName: interviewer?.name,
        })
      } catch (err) {
        console.error('Failed to send interview scheduled email:', err)
      }
    }

    return interview
  }

  async updateInterview(tenantId: string, interviewId: string, dto: UpdateInterviewDto) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, candidate: { tenantId } },
    })
    if (!interview) throw new NotFoundException('Interview not found')
    if (interview.status !== 'SCHEDULED') {
      throw new BadRequestException('Only scheduled interviews can be edited')
    }

    const data: any = {}
    if (dto.type !== undefined) data.type = dto.type
    if (dto.scheduledAt !== undefined) data.scheduledAt = new Date(dto.scheduledAt)
    if (dto.notes !== undefined) data.notes = dto.notes

    return this.prisma.interview.update({
      where: { id: interviewId },
      data,
      include: { candidate: { select: CANDIDATE_SELECT } },
    })
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

    return this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        ratings: dto.ratings,
        notes: dto.notes || interview.notes,
        status: 'COMPLETED',
      },
    })
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

  async getQuestions(type: string, _department?: string) {
    const general = [
      { id: 'g1', category: 'Motivation', question: 'What interests you most about this role?' },
      { id: 'g2', category: 'Experience', question: 'Walk me through the experience that best prepares you for this position.' },
      { id: 'g3', category: 'Role Fit', question: 'What kind of work environment helps you do your best work?' },
      { id: 'g4', category: 'Problem Solving', question: 'Tell me about a recent challenge you worked through.' },
      { id: 'g5', category: 'Availability', question: 'What is your availability and expected timeline for a next step?' },
    ]

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

    if (type === 'TECHNICAL') return technical
    if (type === 'GENERAL') return general
    return behavioral
  }
}
