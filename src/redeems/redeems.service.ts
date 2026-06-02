import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRedeemDto } from "./dto/create-redeem.dto";
import { RedeemStatus } from "@prisma/client";

@Injectable()
export class RedeemsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRedeemDto, hotelOperatorId: string, tenantId?: string) {
    return this.prisma.redeem.create({
      data: {
        title: dto.title,
        schedule: dto.schedule,
        description: dto.description,
        paymentMethod: dto.paymentMethod,
        requestedBy: hotelOperatorId,
        hotelOperatorId,
        tenantId,
      },
    });
  }

  async findAll(tenantId?: string) {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    return this.prisma.redeem.findMany({
      where,
      include: { redeemTransactions: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const redeem = await this.prisma.redeem.findUnique({
      where: { id },
      include: { redeemTransactions: true },
    });
    if (!redeem) throw new NotFoundException("Redeem not found");
    return redeem;
  }

  async updateStatus(id: string, status: RedeemStatus) {
    return this.prisma.redeem.update({ where: { id }, data: { status } });
  }
}
