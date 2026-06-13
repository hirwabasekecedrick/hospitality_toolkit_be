import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { TransactionStatus } from "@prisma/client";

@Injectable()
export class ReconciliationCronService {
  private readonly logger = new Logger(ReconciliationCronService.name);

  constructor(private prisma: PrismaService) {}

  // Runs every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcilePendingTransactions() {
    this.logger.log("Running reconciliation cron job for stuck transactions...");

    // Find transactions that have been PENDING for more than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const stuckTransactions = await this.prisma.transaction.findMany({
      where: {
        status: TransactionStatus.PENDING,
        createdAt: {
          lt: tenMinutesAgo,
        },
      },
      include: {
        card: true,
        serviceProvider: true,
      }
    });

    if (stuckTransactions.length === 0) {
      this.logger.log("No stuck transactions found.");
      return;
    }

    this.logger.log(`Found ${stuckTransactions.length} stuck transactions. Reconciling...`);

    for (const transaction of stuckTransactions) {
      try {
        // In a real scenario, this would query the external payment gateway
        // const externalStatus = await this.paymentGatewaysService.checkStatus(transaction.reference);
        
        // For simulation, we assume any stuck transaction actually FAILED
        this.logger.warn(`Marking stuck transaction ${transaction.id} as FAILED.`);
        
        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: TransactionStatus.FAILED },
        });

      } catch (err) {
        this.logger.error(`Error reconciling transaction ${transaction.id}`, err);
      }
    }
  }
}
