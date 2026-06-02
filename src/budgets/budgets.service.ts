import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateBudgetDto } from "./dto/create-budget.dto";
import { AuditAction } from "@prisma/client";

@Injectable()
export class BudgetsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateBudgetDto, createdById: string, tenantId?: string) {
    const budget = await this.prisma.budget.create({
      data: {
        name: dto.name,
        allocationType: dto.allocationType,
        purpose: dto.purpose,
        allocated: dto.allocated,
        ceiling: dto.ceiling ?? dto.allocated,
        createdById,
        tenantId,
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: "Budget",
      entityId: budget.id,
      description: `Budget created: ${dto.name} for ${dto.allocated}`,
      userId: createdById,
      tenantId,
    });

    return budget;
  }

  async findAll(tenantId?: string) {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    return this.prisma.budget.findMany({
      where,
      include: { budgetUsages: true, cards: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const budget = await this.prisma.budget.findUnique({
      where: { id },
      include: { budgetUsages: { orderBy: { date: "desc" } }, cards: true },
    });
    if (!budget) throw new NotFoundException("Budget not found");
    return budget;
  }
}
