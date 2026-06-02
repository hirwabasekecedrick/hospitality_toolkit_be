import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { RedisService } from "../redis/redis.service";
import { AuditAction, UserRole } from "@prisma/client";
import { RegisterDto } from "./dto/register.dto";

function csrfToken(): string {
  const bytes = new Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function jwtExpirySeconds(): number {
  const exp = process.env.JWT_EXPIRATION || "7d";
  const match = exp.match(/^(\d+)([dhms])$/);
  if (!match) return 7 * 86400;
  const num = parseInt(match[1], 10);
  switch (match[2]) {
    case "d": return num * 86400;
    case "h": return num * 3600;
    case "m": return num * 60;
    default: return num;
  }
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditService: AuditService,
    private redis: RedisService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("Email already in use");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: UserRole.CORPORATE_EMPLOYEE,
        department: dto.department,
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: "User",
      entityId: user.id,
      description: `User ${user.email} registered`,
      userId: user.id,
      ipAddress,
    });

    const jti = uuidv4();
    const payload = { sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId ?? undefined, jti };
    const token = this.jwtService.sign(payload);

    const csrf = csrfToken();

    return {
      accessToken: token,
      csrfToken: csrf,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId ?? undefined,
        department: user.department,
      },
    };
  }

  async login(email: string, password: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const jti = uuidv4();
    const payload = { sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId ?? undefined, jti };
    const token = this.jwtService.sign(payload);

    await this.auditService.log({
      action: AuditAction.LOGIN,
      entity: "User",
      entityId: user.id,
      description: `User ${user.email} logged in`,
      userId: user.id,
      tenantId: user.tenantId ?? undefined,
      ipAddress,
    });

    const csrf = csrfToken();

    return {
      accessToken: token,
      csrfToken: csrf,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId ?? undefined,
        department: user.department,
      },
    };
  }

  async logout(jti: string | undefined) {
    if (jti) {
      const ttl = jwtExpirySeconds();
      await this.redis.blacklistToken(jti, ttl);
    }
    return { message: "Logged out successfully" };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        tenantId: true,
        department: true,
        createdAt: true,
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!user) throw new UnauthorizedException("User not found");
    return user;
  }

  jwtExpirySeconds(): number {
    return jwtExpirySeconds();
  }
}
