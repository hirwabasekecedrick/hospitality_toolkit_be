import { Module } from "@nestjs/common";
import { ReconciliationCronService } from "./reconciliation.cron";
import { PrismaModule } from "../prisma/prisma.module";
import { PaymentGatewaysModule } from "../payment-gateways/payment-gateways.module";

@Module({
  imports: [PrismaModule, PaymentGatewaysModule],
  providers: [ReconciliationCronService],
})
export class ReconciliationModule {}
