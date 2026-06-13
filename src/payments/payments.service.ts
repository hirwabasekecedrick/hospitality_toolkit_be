import { Injectable, NotFoundException, ForbiddenException, BadRequestException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CardsService } from "../cards/cards.service";
import { ServiceProvidersService } from "../service-providers/service-providers.service";
import { PaymentGatewaysService } from "../payment-gateways/payment-gateways.service";
import { AuditAction, TransactionStatus, RedeemStatus } from "@prisma/client";

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private cardsService: CardsService,
    private serviceProvidersService: ServiceProvidersService,
    private auditService: AuditService,
    private paymentGatewaysService: PaymentGatewaysService,
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
      if (budget && budget.spent.plus(dto.amount).greaterThan(budget.ceiling)) {
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
        status: TransactionStatus.CONFIRMED,
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

    await this.auditService.log({
      action: AuditAction.PAYMENT,
      entity: "Transaction",
      entityId: transaction.id,
      description: `Payment of ${dto.amount} to ${provider.name} via card ${card.last4} initiated`,
      userId,
      tenantId,
      ipAddress,
    });

    // Deduct amounts internally upon confirmation
    const cardUpdateData: any = { spent: { increment: dto.amount } };
    if (card.amount !== null && card.amount !== undefined) {
      cardUpdateData.amount = { decrement: dto.amount };
    }

    await this.prisma.card.update({
      where: { id: card.id },
      data: cardUpdateData,
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

    // Notifications
    await this.prisma.notification.create({
      data: {
        title: "Payment confirmed",
        subtitle: `Payment to ${provider.name}`,
        message: `Your payment of RWF ${Number(dto.amount).toLocaleString()} to ${provider.name} has been confirmed.`,
        type: "Payment",
        actionLabel: "View transaction",
        actionUrl: `/corporate_employee/payments/${transaction.id}`,
        transactionId: transaction.id,
        userId: userId,
      },
    });

    return { transaction, provider };
  }

  async getProviderTransactions(serviceProviderId: string, status?: string) {
    const where: any = { serviceProviderId };
    if (status) {
      where.status = status;
    }
    const txns = await this.prisma.transaction.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        card: { select: { id: true, last4: true, type: true, spent: true, amount: true } },
        serviceProvider: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Map to compact shape expected by frontend: include employee name and hotel name only
    return txns.map((t) => ({
      id: t.id,
      title: t.title,
      amount: t.amount,
      status: t.status,
      reference: t.reference,
      paymentMethod: t.paymentMethod,
      details: t.details,
      employeeName: t.user ? `${t.user.firstName} ${t.user.lastName}`.trim() : "",
      hotelName: t.serviceProvider ? t.serviceProvider.name : "",
      createdAt: t.createdAt,
      card: t.card ? { id: t.card.id, last4: t.card.last4, type: t.card.type, spent: t.card.spent, amount: t.card.amount } : undefined,
    }));
  }

  async redeemBatch(dto: { transactionIds: string[] }, userId: string, serviceProviderId: string, tenantId?: string) {
    if (!dto.transactionIds || dto.transactionIds.length === 0) {
      throw new BadRequestException("No transactions specified");
    }

    const transactions = await this.prisma.transaction.findMany({
      where: { id: { in: dto.transactionIds }, serviceProviderId, status: TransactionStatus.CONFIRMED },
    });

    if (transactions.length !== dto.transactionIds.length) {
      throw new BadRequestException("Some transactions are not confirmed, already settled, or do not belong to your hotel");
    }

    const totalAmount = transactions.reduce((sum, t) => sum + t.amount.toNumber(), 0);

    const redeem = await this.prisma.redeem.create({
      data: {
        title: `Batch redeem — ${transactions.length} transaction(s)`,
        schedule: "Manual",
        status: RedeemStatus.COMPLETED,
        description: `Redeemed ${transactions.length} transaction(s) totaling RWF ${Number(totalAmount).toLocaleString()}`,
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
      description: `Batch redeem of ${transactions.length} transactions totaling RWF ${Number(totalAmount).toLocaleString()}`,
      userId,
      tenantId,
    });

    for (const txn of transactions) {
      if (txn.userId) {
        await this.prisma.notification.create({
          data: {
            title: "Payment settled",
            subtitle: `Transaction ${txn.reference} has been settled`,
            message: `Your payment of RWF ${Number(txn.amount).toLocaleString()} has been settled by the hotel.`,
            type: "Payment",
            userId: txn.userId,
            transactionId: txn.id,
          },
        });
      }
    }

    return redeem;
  }

  async getUserTransactions(userId: string, tenantId: string, role?: string) {
    // Return transactions according to requesting user's role:
    // - CORPORATE_EMPLOYEE: only transactions created by the user
    // - CORPORATE_ADMIN: all transactions for the tenant
    // - otherwise: default to user-only
    let txns;
    if (role === "CORPORATE_ADMIN") {
      txns = await this.prisma.transaction.findMany({
        where: { tenantId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          serviceProvider: { select: { id: true, name: true } },
          card: { select: { id: true, last4: true, type: true, spent: true, amount: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      txns = await this.prisma.transaction.findMany({
        where: { userId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          serviceProvider: { select: { id: true, name: true } },
          card: { select: { id: true, last4: true, type: true, spent: true, amount: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return txns.map((t) => ({
      id: t.id,
      title: t.title,
      amount: t.amount,
      status: t.status,
      reference: t.reference,
      paymentMethod: t.paymentMethod,
      details: t.details,
      employeeName: t.user ? `${t.user.firstName} ${t.user.lastName}`.trim() : "",
      hotelName: t.serviceProvider ? t.serviceProvider.name : "",
      createdAt: t.createdAt,
      card: t.card ? { id: t.card.id, last4: t.card.last4, type: t.card.type, spent: t.card.spent, amount: t.card.amount } : undefined,
    }));
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
