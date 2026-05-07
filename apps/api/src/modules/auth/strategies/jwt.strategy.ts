import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        status: 'ACTIVE',
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      name: user.name,
    };
  }
}
