import { Injectable, ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto, tenantId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("Email already in use");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: dto.role,
        tenantId,
        department: dto.department,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        tenantId: true,
        department: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async findAll(tenantId?: string, role?: string) {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (role) where.role = role;

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        tenantId: true,
        department: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, requestingTenantId?: string, requestingRole?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        tenantId: true,
        department: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException("User not found");
    if (requestingRole !== "SUPER_ADMIN" && user.tenantId !== requestingTenantId) {
      throw new UnauthorizedException("You do not have access to this user");
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    const data: any = {};
    if (dto.email) data.email = dto.email;
    if (dto.firstName) data.firstName = dto.firstName;
    if (dto.lastName) data.lastName = dto.lastName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.role) data.role = dto.role;
    if (dto.department !== undefined) data.department = dto.department;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    if (dto.cardPassword !== undefined) data.cardPassword = dto.cardPassword;

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        tenantId: true,
        department: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: "User deactivated successfully" };
  }
}
