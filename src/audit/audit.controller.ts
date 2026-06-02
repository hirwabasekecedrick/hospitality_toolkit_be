import { Controller, Get, Query } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UserRole } from "@prisma/client";

@Controller("audit-logs")
@Roles(UserRole.SUPER_ADMIN)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  async findAll(
    @Query("skip") skip?: string,
    @Query("take") take?: string,
    @CurrentUser() user?: any,
  ) {
    return this.auditService.findAll({
      tenantId: user?.tenantId,
      skip: skip ? parseInt(skip) : undefined,
      take: take ? parseInt(take) : undefined,
    });
  }
}
