import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuditAction } from "@prisma/client";
import { ExchangeCurrencyDto } from "./dto/exchange-currency.dto";
import { generateExchangeReference } from "../common/utils/transaction.util";

const TRUSTED_USD_RWF_RATE = parseFloat(process.env.USD_RWF_RATE || "1300");
const RATE_TOLERANCE = 0.02;

@Injectable()
export class WalletService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async exchange(dto: ExchangeCurrencyDto, userId: string, ipAddress?: string) {
    if (Math.abs(dto.rate - TRUSTED_USD_RWF_RATE) / TRUSTED_USD_RWF_RATE > RATE_TOLERANCE) {
      throw new BadRequestException("Exchange rate outside trusted range");
    }

    const rwfAmount = Math.round(dto.usdAmount * dto.rate * 100) / 100;
    if (rwfAmount <= 0) {
      throw new BadRequestException("Invalid exchange amount");
    }

    const reference = generateExchangeReference();

    const log = await this.prisma.exchangeLog.create({
      data: {
        userId,
        usdAmount: dto.usdAmount,
        rate: dto.rate,
        rwfAmount,
        reference,
      },
    });

    await this.auditService.log({
      action: AuditAction.EXCHANGE,
      entity: "ExchangeLog",
      entityId: log.id,
      description: `USD ${dto.usdAmount} → RWF ${rwfAmount} at rate ${dto.rate}`,
      userId,
      ipAddress,
      newValue: { usdAmount: dto.usdAmount, rate: dto.rate, rwfAmount, reference },
    });

    return log;
  }
}
