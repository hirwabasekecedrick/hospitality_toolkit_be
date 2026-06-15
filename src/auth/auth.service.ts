import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { RedisService } from "../redis/redis.service";
import { AccountStatus, AuditAction, UserRole } from "@prisma/client";
import { RegisterDto } from "./dto/register.dto";

const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

function csrfToken(): string {
  return randomBytes(32).toString("hex");
}

function parseExpiryToSeconds(exp: string, fallbackSeconds: number): number {
  const match = exp.match(/^(\d+)([dhms])$/);
  if (!match) return fallbackSeconds;
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
    private configService: ConfigService,
    private auditService: AuditService,
    private redis: RedisService,
  ) {}

  private accessExpiry(): string {
    return this.configService.get<string>("JWT_ACCESS_EXPIRATION") || "15m";
  }

  private refreshExpiry(): string {
    return this.configService.get<string>("JWT_REFRESH_EXPIRATION") || "7d";
  }

  private accessExpirySeconds(): number {
    return parseExpiryToSeconds(this.accessExpiry(), 15 * 60);
  }

  private refreshExpirySeconds(): number {
    return parseExpiryToSeconds(this.refreshExpiry(), 7 * 86400);
  }

  private refreshExpiryDate(): Date {
    return new Date(Date.now() + this.refreshExpirySeconds() * 1000);
  }

  private async createTokenPair(user: {
    id: string;
    email: string;
    role: UserRole;
    tenantId: string | null;
  }, meta?: { deviceName?: string; ipAddress?: string; userAgent?: string }) {
    const jti = uuidv4();
    const accessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ?? undefined,
      jti,
      type: "access",
    };
    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this.accessExpiry() as any,
    });

    const refreshRaw = randomBytes(48).toString("hex");
    const refreshHash = await bcrypt.hash(refreshRaw, 10);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshHash,
        userId: user.id,
        deviceName: meta?.deviceName,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
        expiresAt: this.refreshExpiryDate(),
      },
    });

    return { accessToken, refreshToken: refreshRaw, csrfToken: csrfToken(), jti };
  }

  private async createEmailVerificationToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString("hex");
    await this.prisma.emailVerificationToken.create({
      data: {
        token,
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return token;
  }

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const firstName = dto.firstName?.trim() || dto.fullName?.trim().split(/\s+/)[0] || "User";
    const lastName =
      dto.lastName?.trim() ||
      dto.fullName?.trim().split(/\s+/).slice(1).join(" ") ||
      "Account";

    const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingEmail) {
      throw new ConflictException("Email already in use");
    }

    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (existingPhone) {
        throw new ConflictException("Phone number already in use");
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        firstName,
        lastName,
        phone: dto.phone,
        countryCode: dto.countryCode,
        role: UserRole.CORPORATE_EMPLOYEE,
        department: dto.department,
        isVerified: false,
        accountStatus: AccountStatus.PENDING_VERIFICATION,
      },
    });

    const verificationToken = await this.createEmailVerificationToken(user.id);

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: "User",
      entityId: user.id,
      description: `User ${user.email} registered`,
      userId: user.id,
      ipAddress,
    });

    const tokens = await this.createTokenPair(user, {
      deviceName: dto.deviceName,
      ipAddress,
      userAgent,
    });

    return {
      ...tokens,
      verificationToken: process.env.NODE_ENV === "production" ? undefined : verificationToken,
      user: this.publicUser(user),
    };
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.emailVerificationToken.findUnique({ where: { token } });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired verification token");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { isVerified: true, accountStatus: AccountStatus.ACTIVE },
      }),
      this.prisma.emailVerificationToken.delete({ where: { id: record.id } }),
    ]);

    return { message: "Email verified successfully" };
  }

  async login(email: string, password: string, meta?: { deviceName?: string; ipAddress?: string; userAgent?: string }) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException("Account temporarily locked due to failed login attempts");
    }

    if (user.accountStatus === AccountStatus.BLOCKED || user.accountStatus === AccountStatus.SUSPENDED) {
      throw new ForbiddenException(`Account is ${user.accountStatus.toLowerCase().replace("_", " ")}`);
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      const attempts = user.failedLoginAttempts + 1;
      const updateData: { failedLoginAttempts: number; lockedUntil?: Date } = { failedLoginAttempts: attempts };
      if (attempts >= MAX_FAILED_LOGINS) {
        updateData.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      }
      await this.prisma.user.update({ where: { id: user.id }, data: updateData });
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.accountStatus === AccountStatus.PENDING_VERIFICATION || !user.isVerified) {
      throw new ForbiddenException("Please verify your email before logging in");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    await this.prisma.loginSession.create({
      data: {
        userId: user.id,
        deviceName: meta?.deviceName,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    });

    const tokens = await this.createTokenPair(user, meta);

    await this.auditService.log({
      action: AuditAction.LOGIN,
      entity: "User",
      entityId: user.id,
      description: `User ${user.email} logged in`,
      userId: user.id,
      tenantId: user.tenantId ?? undefined,
      ipAddress: meta?.ipAddress,
    });

    return {
      ...tokens,
      user: this.publicUser(user),
    };
  }

  async refresh(refreshToken: string, meta?: { ipAddress?: string; userAgent?: string }) {
    const activeTokens = await this.prisma.refreshToken.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    let matched: (typeof activeTokens)[number] | undefined;
    for (const record of activeTokens) {
      if (await bcrypt.compare(refreshToken, record.token)) {
        matched = record;
        break;
      }
    }

    if (!matched || !matched.user.isActive) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.createTokenPair(matched.user, {
      deviceName: matched.deviceName ?? undefined,
      ipAddress: meta?.ipAddress ?? matched.ipAddress ?? undefined,
      userAgent: meta?.userAgent ?? matched.userAgent ?? undefined,
    });

    return tokens;
  }

  async logout(jti: string | undefined, refreshToken?: string) {
    if (jti) {
      await this.redis.blacklistToken(jti, this.accessExpirySeconds());
    }

    if (refreshToken) {
      const activeTokens = await this.prisma.refreshToken.findMany({
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
      });
      for (const record of activeTokens) {
        if (await bcrypt.compare(refreshToken, record.token)) {
          await this.prisma.refreshToken.update({
            where: { id: record.id },
            data: { revokedAt: new Date() },
          });
          break;
        }
      }
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
        countryCode: true,
        role: true,
        isActive: true,
        isVerified: true,
        accountStatus: true,
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
    return this.accessExpirySeconds();
  }

  private publicUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    tenantId: string | null;
    department: string | null;
    isVerified?: boolean;
    accountStatus?: AccountStatus;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId ?? undefined,
      department: user.department,
      isVerified: user.isVerified,
      accountStatus: user.accountStatus,
    };
  }
}
