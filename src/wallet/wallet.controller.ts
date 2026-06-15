import { Controller, Post, Body, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { WalletService } from "./wallet.service";
import { ExchangeCurrencyDto } from "./dto/exchange-currency.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@Controller("wallet")
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @Post("exchange")
  async exchange(
    @Body() dto: ExchangeCurrencyDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.walletService.exchange(dto, user.id, req.ip);
  }
}
