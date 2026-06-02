import { Controller, Get } from "@nestjs/common";
import { TransactionsService } from "./transactions.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@Controller("transactions")
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get()
  @Roles(UserRole.CORPORATE_ADMIN, UserRole.SUPER_ADMIN)
  async findAll(@CurrentUser() user: any) {
    return this.transactionsService.findAll(user.tenantId);
  }
}
