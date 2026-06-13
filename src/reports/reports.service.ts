import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getOverview(tenantId?: string) {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;

    const [totalCards, activeCards, totalTransactions, totalSpent, completedRedeems] = await Promise.all([
      this.prisma.card.count({ where }),
      this.prisma.card.count({ where: { ...where, status: "ACTIVE" } }),
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.aggregate({ where, _sum: { amount: true } }),
      this.prisma.redeem.count({ where: { ...where, status: "COMPLETED" } }),
    ]);

    return {
      totalCards,
      activeCards,
      totalTransactions,
      totalSpent: totalSpent._sum.amount?.toNumber() || 0,
      completedRedeems,
    };
  }

  async getCardUsage(tenantId: string) {
    const cards = await this.prisma.card.findMany({
      where: { tenantId },
      include: {
        teamLeader: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { spent: "desc" },
    });

    return cards.map((c) => ({
      id: c.id,
      last4: c.last4,
      type: c.type,
      status: c.status,
      limit: c.limit,
      amount: c.amount ? c.amount.toNumber() : null,
      spent: c.spent.toNumber(),
      remaining: c.limit ? c.limit.minus(c.spent).toNumber() : null,
      usagePercent: c.limit ? Math.round((c.spent.toNumber() / c.limit.toNumber()) * 100) : 0,
      purpose: c.purpose,
      cardholder: c.teamLeader
        ? `${c.teamLeader.firstName} ${c.teamLeader.lastName}`
        : "Unassigned",
    }));
  }

  async getHotelPerformance() {
    const providers = await this.prisma.serviceProvider.findMany({
      include: {
        transactions: {
          where: { status: "SETTLED" },
          select: { amount: true },
        },
      },
    });

    return providers.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      totalTransactions: p.transactions.length,
      totalRevenue: p.transactions.reduce((sum, t) => sum + t.amount.toNumber(), 0),
    }));
  }

  async getBudgetUtilization(tenantId: string) {
    const budgets = await this.prisma.budget.findMany({
      where: { tenantId },
      include: { budgetUsages: true },
    });

    return budgets.map((b) => ({
      id: b.id,
      name: b.name,
      allocationType: b.allocationType,
      allocated: b.allocated.toNumber(),
      spent: b.spent.toNumber(),
      ceiling: b.ceiling.toNumber(),
      remaining: b.ceiling.minus(b.spent).toNumber(),
      usagePercent: b.ceiling.toNumber() > 0 ? Math.round((b.spent.toNumber() / b.ceiling.toNumber()) * 100) : 0,
      usageCount: b.budgetUsages.length,
    }));
  }

  async getEmployeeSpending(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId, role: "CORPORATE_EMPLOYEE" },
      include: {
        transactions: {
          select: { amount: true, status: true },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      department: u.department,
      totalSpent: u.transactions.reduce((sum, t) => sum + t.amount.toNumber(), 0),
      transactionCount: u.transactions.length,
      pendingCount: u.transactions.filter((t) => t.status === "PENDING").length,
    }));
  }

  async getMyUsage(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      include: { serviceProvider: true, card: true },
      orderBy: { createdAt: "desc" },
    });

    const totalSpent = transactions.reduce((sum, t) => sum + t.amount.toNumber(), 0);

    return {
      totalTransactions: transactions.length,
      totalSpent,
      recentTransactions: transactions.slice(0, 10),
    };
  }

  async getProviderSummary(serviceProviderId: string) {
    const where = { serviceProviderId };

    const [pendingCount, settledCount, totalRevenue, recentTransactions] = await Promise.all([
      this.prisma.transaction.count({ where: { ...where, status: "PENDING" } }),
      this.prisma.transaction.count({ where: { ...where, status: "SETTLED" } }),
      this.prisma.transaction.aggregate({
        where: { ...where, status: "SETTLED" },
        _sum: { amount: true },
      }),
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    return {
      pendingCount,
      settledCount,
      totalRevenue: totalRevenue._sum.amount?.toNumber() || 0,
      recentTransactions,
    };
  }
}
