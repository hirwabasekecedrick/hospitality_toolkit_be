import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { CardsModule } from "../cards/cards.module";
import { ServiceProvidersModule } from "../service-providers/service-providers.module";

@Module({
  imports: [CardsModule, ServiceProvidersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
