import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId?: string) {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;

    return this.prisma.transaction.findMany({
      where,
      include: { serviceProvider: true, user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
}
