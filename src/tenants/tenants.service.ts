import { Injectable, ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException("Tenant slug already exists");

    return this.prisma.tenant.create({ data: dto });
  }

  async findAll() {
    return this.prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    return tenant;
  }
}
