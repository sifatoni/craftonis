import {
  Controller,
  Get,
  Post,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { CvService } from '../cv/cv.service';

/**
 * ⚠️ TEMPORARY DEBUG CONTROLLER — Remove before production deployment.
 * All endpoints are PUBLIC (no JWT required) for local testing only.
 */
@ApiTags('🔧 Debug (Temporary — No Auth)')
@Controller('debug')
export class DebugController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cvService: CvService,
  ) {}

  // ── GET /api/v1/debug/candidates ──────────────────────────
  @Get('candidates')
  @ApiOperation({
    summary: '[DEBUG] List all candidates (no auth)',
    description:
      'Returns candidate id, name, email, and stage for all records. TEMPORARY — no JWT required.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of candidates returned successfully.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          stage: { type: 'string' },
          tenantId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async listCandidates() {
    const candidates = await this.prisma.candidate.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        stage: true,
        tenantId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      count: candidates.length,
      candidates,
    };
  }

  // ── POST /api/v1/debug/cv/:candidateId/parse ──────────────
  @Post('cv/:candidateId/parse')
  @ApiOperation({
    summary: '[DEBUG] Parse CV for a candidate (no auth)',
    description:
      'Uploads and parses a CV PDF for the given candidateId. Reuses CvService.parseCv internally. TEMPORARY — no JWT required.',
  })
  @ApiParam({
    name: 'candidateId',
    description: 'UUID of the candidate',
    type: 'string',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'CV PDF file (max 5MB)' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'CV parsed successfully.',
  })
  @UseInterceptors(FileInterceptor('file'))
  async parseCv(
    @Param('candidateId') candidateId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: 'application/pdf' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    // Fetch the candidate to get their tenantId (required by CvService.parseCv)
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { id: true, tenantId: true },
    });

    if (!candidate) {
      return { error: `Candidate with id "${candidateId}" not found.` };
    }

    // Delegate to existing CvService — no logic duplication
    return this.cvService.parseCv(candidateId, candidate.tenantId, file.buffer);
  }
}
