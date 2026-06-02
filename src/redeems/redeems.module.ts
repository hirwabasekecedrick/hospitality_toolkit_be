import { Module } from "@nestjs/common";
import { RedeemsController } from "./redeems.controller";
import { RedeemsService } from "./redeems.service";

@Module({
  controllers: [RedeemsController],
  providers: [RedeemsService],
})
export class RedeemsModule {}
