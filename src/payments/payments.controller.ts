import { Controller, Post, Get, Body, Param, Req, Query } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { InitiatePaymentDto } from "./dto/initiate-payment.dto";
import { ConfirmPaymentDto } from "./dto/confirm-payment.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@Controller("payments")
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post("initiate")
  @Roles(UserRole.CORPORATE_EMPLOYEE, UserRole.CORPORATE_ADMIN)
  async initiate(@Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiate(dto.hotelCode);
  }

  @Post("confirm")
  @Roles(UserRole.CORPORATE_EMPLOYEE, UserRole.CORPORATE_ADMIN)
  async confirm(@Body() dto: ConfirmPaymentDto, @CurrentUser() user: any, @Req() req: any) {
    return this.paymentsService.confirm(dto, user.id, user.tenantId, req.ip);
  }

  @Get()
  @Roles(UserRole.CORPORATE_EMPLOYEE, UserRole.CORPORATE_ADMIN)
  async getUserTransactions(@CurrentUser() user: any) {
    return this.paymentsService.getUserTransactions(user.id, user.tenantId, user.role);
  }

  @Get("provider")
  @Roles(UserRole.HOTEL_OPERATOR)
  async getProviderTransactions(@CurrentUser() user: any, @Query("status") status?: string) {
    return this.paymentsService.getProviderTransactions(user.serviceProviderId, status);
  }

  @Post("redeem-batch")
  @Roles(UserRole.HOTEL_OPERATOR)
  async redeemBatch(@Body("transactionIds") transactionIds: string[], @CurrentUser() user: any) {
    return this.paymentsService.redeemBatch(
      { transactionIds },
      user.id,
      user.serviceProviderId,
      user.tenantId,
    );
  }

  @Get(":id")
  @Roles(UserRole.CORPORATE_EMPLOYEE, UserRole.CORPORATE_ADMIN, UserRole.HOTEL_OPERATOR, UserRole.SUPER_ADMIN)
  async getTransaction(@Param("id") id: string, @CurrentUser() user: any) {
    return this.paymentsService.getTransactionById(id, user);
  }
}
