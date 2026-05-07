import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create tenant + super admin user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.companyName },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
        },
      });

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: 'STARTER',
          status: 'ACTIVE',
        },
      });

      return { tenant, user };
    });

    const tokens = await this.generateTokens(
      result.user.id,
      result.tenant.id,
      result.user.email,
      result.user.role,
    );

    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        plan: result.tenant.plan,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, status: 'ACTIVE' },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(
      user.id,
      user.tenantId,
      user.email,
      user.role,
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        plan: user.tenant.plan,
        tokenBalance: user.tenant.tokenBalance,
      },
      ...tokens,
    };
  }

  async getMe(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { tenant: true },
    });

    if (!user) throw new UnauthorizedException();

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        plan: user.tenant.plan,
        tokenBalance: user.tenant.tokenBalance,
      },
    };
  }

  private async generateTokens(
    userId: string,
    tenantId: string,
    email: string,
    role: string,
  ) {
    const payload = { sub: userId, tenantId, email, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN') || '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    return { accessToken, refreshToken };
  }
}
