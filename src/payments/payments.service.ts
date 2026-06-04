import { Injectable, NotFoundException, ForbiddenException, BadRequestException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CardsService } from "../cards/cards.service";
import { ServiceProvidersService } from "../service-providers/service-providers.service";
import { AuditAction, TransactionStatus, RedeemStatus } from "@prisma/client";

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private cardsService: CardsService,
    private serviceProvidersService: ServiceProvidersService,
    private auditService: AuditService,
  ) {}

  async initiate(hotelCode: string) {
    const provider = await this.serviceProvidersService.findByCode(hotelCode);
    return { hotelName: provider.name, hotelCode: provider.code };
  }

  async confirm(
    dto: { hotelCode: string; amount: number; cardPassword: string; cardId: string },
    userId: string,
    tenantId: string,
    ipAddress?: string,
  ) {
    const provider = await this.serviceProvidersService.findByCode(dto.hotelCode);
    const card = await this.cardsService.validateCardForPayment(
      dto.cardId,
      dto.cardPassword,
      dto.amount,
      userId,
    );

    if (card.budgetId) {
      const budget = await this.prisma.budget.findUnique({ where: { id: card.budgetId } });
      if (budget && budget.spent + dto.amount > budget.ceiling) {
        throw new ForbiddenException("Payment would exceed the linked budget ceiling");
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    });

    const reference = `PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const transaction = await this.prisma.transaction.create({
      data: {
        title: `Payment to ${provider.name}`,
        amount: dto.amount,
        status: TransactionStatus.PENDING,
        reference,
        paymentMethod: "Corporate card",
        details: `Payment via ${card.type} card ${card.last4}`,
        clientName: user ? `${user.firstName} ${user.lastName}`.trim() : "Employee",
        clientOrg: tenantId || "",
        cardId: card.id,
        userId,
        serviceProviderId: provider.id,
        tenantId,
      },
    });

    await this.prisma.card.update({
      where: { id: card.id },
      data: { spent: { increment: dto.amount } },
    });

    if (card.budgetId) {
      await this.prisma.budget.update({
        where: { id: card.budgetId },
        data: { spent: { increment: dto.amount } },
      });
      await this.prisma.budgetUsage.create({
        data: {
          description: `Payment to ${provider.name}`,
          amount: dto.amount,
          budgetId: card.budgetId,
        },
      });
    }

    await this.auditService.log({
      action: AuditAction.PAYMENT,
      entity: "Transaction",
      entityId: transaction.id,
      description: `Payment of ${dto.amount} to ${provider.name} via card ${card.last4}`,
      userId,
      tenantId,
      ipAddress,
    });

    await this.prisma.notification.create({
      data: {
        title: "Payment approved",
        subtitle: `Payment to ${provider.name}`,
        message: `Your payment of RWF ${dto.amount.toLocaleString()} to ${provider.name} has been approved and settled.`,
        type: "Payment",
        actionLabel: "View transaction",
        actionUrl: `/corporate_employee/payments/${transaction.id}`,
        transactionId: transaction.id,
        userId,
      },
    });

    return { transaction, provider };
  }

  async getProviderTransactions(serviceProviderId: string, status?: string) {
    const where: any = { serviceProviderId };
    if (status) {
      where.status = status;
    } else {
      where.status = TransactionStatus.PENDING;
    }
    return this.prisma.transaction.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        card: { select: { id: true, last4: true, type: true } },
        serviceProvider: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async redeemBatch(dto: { transactionIds: string[] }, userId: string, serviceProviderId: string, tenantId?: string) {
    if (!dto.transactionIds || dto.transactionIds.length === 0) {
      throw new BadRequestException("No transactions specified");
    }

    const transactions = await this.prisma.transaction.findMany({
      where: { id: { in: dto.transactionIds }, serviceProviderId, status: TransactionStatus.PENDING },
    });

    if (transactions.length !== dto.transactionIds.length) {
      throw new BadRequestException("Some transactions are not valid, already settled, or do not belong to your hotel");
    }

    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

    const redeem = await this.prisma.redeem.create({
      data: {
        title: `Batch redeem — ${transactions.length} transaction(s)`,
        schedule: "Manual",
        status: RedeemStatus.COMPLETED,
        description: `Redeemed ${transactions.length} transaction(s) totaling RWF ${totalAmount.toLocaleString()}`,
        requestedBy: userId,
        hotelOperatorId: userId,
        tenantId,
        redeemTransactions: {
          create: transactions.map((t) => ({
            amount: t.amount,
            guest: t.userId || "",
            property: t.serviceProviderId || "",
            reference: t.reference,
            status: "Settled",
          })),
        },
      },
      include: { redeemTransactions: true },
    });

    await this.prisma.transaction.updateMany({
      where: { id: { in: dto.transactionIds } },
      data: { status: TransactionStatus.SETTLED },
    });

    await this.auditService.log({
      action: AuditAction.PAYMENT,
      entity: "Redeem",
      entityId: redeem.id,
      description: `Batch redeem of ${transactions.length} transactions totaling RWF ${totalAmount.toLocaleString()}`,
      userId,
      tenantId,
    });

    for (const txn of transactions) {
      if (txn.userId) {
        await this.prisma.notification.create({
          data: {
            title: "Payment settled",
            subtitle: `Transaction ${txn.reference} has been settled`,
            message: `Your payment of RWF ${txn.amount.toLocaleString()} has been settled by the hotel.`,
            type: "Payment",
            userId: txn.userId,
            transactionId: txn.id,
          },
        });
      }
    }

    return redeem;
  }

  async getUserTransactions(userId: string, tenantId: string) {
    return this.prisma.transaction.findMany({
      where: { OR: [{ userId }, { tenantId }] },
      include: { serviceProvider: true, card: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getTransactionById(id: string, requestingUser?: { id: string; role: string; tenantId?: string; serviceProviderId?: string }) {
    const txn = await this.prisma.transaction.findUnique({
      where: { id },
      include: { serviceProvider: true, card: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    if (!txn) throw new NotFoundException("Transaction not found");

    if (requestingUser) {
      if (requestingUser.role === "SUPER_ADMIN") return txn;
      if (requestingUser.role === "HOTEL_OPERATOR" && txn.serviceProviderId === requestingUser.serviceProviderId) return txn;
      if (requestingUser.role === "CORPORATE_ADMIN" && txn.tenantId === requestingUser.tenantId) return txn;
      if (requestingUser.role === "CORPORATE_EMPLOYEE" && txn.userId === requestingUser.id) return txn;
      throw new UnauthorizedException("You do not have access to this transaction");
    }

    return txn;
  }
}
