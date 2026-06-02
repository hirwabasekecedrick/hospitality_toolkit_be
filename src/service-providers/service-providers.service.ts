import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateServiceProviderDto } from "./dto/create-service-provider.dto";

@Injectable()
export class ServiceProvidersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateServiceProviderDto, tenantId?: string) {
    const existing = await this.prisma.serviceProvider.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException("Service provider with this code already exists");

    return this.prisma.serviceProvider.create({
      data: { ...dto, tenantId },
    });
  }

  async findAll(tenantId?: string) {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    return this.prisma.serviceProvider.findMany({ where, orderBy: { name: "asc" } });
  }

  async findOne(id: string) {
    const provider = await this.prisma.serviceProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException("Service provider not found");
    return provider;
  }

  async findByCode(code: string) {
    const provider = await this.prisma.serviceProvider.findUnique({ where: { code } });
    if (!provider) throw new NotFoundException("Service provider not found");
    return provider;
  }
}
