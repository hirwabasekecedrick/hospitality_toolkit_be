import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { TokenBlacklistService } from "../../token-blacklist/token-blacklist.service";

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId?: string;
  jti?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private tokenBlacklist: TokenBlacklistService,
  ) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is required");
    }
    super({
      jwtFromRequest: (req: Request) => {
        if (req?.cookies?.access_token) return req.cookies.access_token;
        const authHeader = req?.headers?.authorization;
        if (authHeader) return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        return null;
      },
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    // Handle case where no token is provided
    if (!payload) {
      throw new UnauthorizedException("No token provided");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        tenantId: true,
        department: true,
        serviceProviderId: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("User not found or inactive");
    }

    if (payload.jti) {
      const blacklisted = await this.tokenBlacklist.isTokenBlacklisted(payload.jti);
      if (blacklisted) {
        throw new UnauthorizedException("Token has been revoked");
      }
    }

    return user;
  }
}
