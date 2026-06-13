import { Controller, Post, Body, Headers, UnauthorizedException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TransactionStatus, AuditAction } from "@prisma/client";

@Controller("api/webhooks/payment")
export class PaymentGatewaysWebhookController {
  private readonly logger = new Logger(PaymentGatewaysWebhookController.name);

  constructor(private prisma: PrismaService) {}

  @Post()
  async handleWebhook(
    @Headers("x-webhook-signature") signature: string,
    @Body() body: { transactionId: string; status: "SUCCESS" | "FAILED"; gatewayReference: string }
  ) {
    if (signature !== "mock-signature") {
      throw new UnauthorizedException("Invalid webhook signature");
    }

    this.logger.log(`Received webhook for transaction ${body.transactionId}: ${body.status}`);

    const transaction = await this.prisma.transaction.findUnique({
      where: { id: body.transactionId },
      include: {
        card: true,
        serviceProvider: true,
        user: true,
      }
    });

    if (!transaction || transaction.status !== TransactionStatus.PENDING) {
      this.logger.warn(`Transaction ${body.transactionId} not found or not PENDING`);
      return { received: true };
    }

    if (body.status === "SUCCESS") {
      // Deduct amounts internally only after confirmation
      const cardUpdateData: any = { spent: { increment: transaction.amount } };
      if (transaction.card?.amount !== null && transaction.card?.amount !== undefined) {
        cardUpdateData.amount = { decrement: transaction.amount };
      }

      await this.prisma.card.update({
        where: { id: transaction.cardId! },
        data: cardUpdateData,
      });

      if (transaction.card?.budgetId) {
        await this.prisma.budget.update({
          where: { id: transaction.card?.budgetId },
          data: { spent: { increment: transaction.amount } },
        });
        await this.prisma.budgetUsage.create({
          data: {
            description: `Payment to ${transaction.serviceProvider?.name}`,
            amount: transaction.amount,
            budgetId: transaction.card.budgetId,
          },
        });
      }

      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: TransactionStatus.CONFIRMED },
      });

      // Notifications (simplified for webhook context)
      if (transaction.userId) {
        await this.prisma.notification.create({
          data: {
            title: "Payment approved",
            subtitle: `Payment to ${transaction.serviceProvider?.name}`,
            message: `Your payment of ${transaction.currency} ${Number(transaction.amount).toLocaleString()} to ${transaction.serviceProvider?.name} has been approved and settled.`,
            type: "Payment",
            actionLabel: "View transaction",
            actionUrl: `/corporate_employee/payments/${transaction.id}`,
            transactionId: transaction.id,
            userId: transaction.userId,
          },
        });
      }
    } else {
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: TransactionStatus.FAILED },
      });
    }

    return { received: true };
  }
}
