import { Module } from "@nestjs/common";
import { PaymentGatewaysService } from "./payment-gateways.service";
import { PaymentGatewaysWebhookController } from "./payment-gateways.webhook.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [PaymentGatewaysService],
  controllers: [PaymentGatewaysWebhookController],
  exports: [PaymentGatewaysService],
})
export class PaymentGatewaysModule {}
