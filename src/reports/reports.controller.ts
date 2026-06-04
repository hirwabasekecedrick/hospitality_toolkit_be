import { Controller, Get } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UserRole } from "@prisma/client";

@Controller("reports")
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get("overview")
  @Roles(UserRole.SUPER_ADMIN, UserRole.CORPORATE_ADMIN)
  async getOverview(@CurrentUser() user: any) {
    return this.reportsService.getOverview(user.tenantId);
  }

  @Get("card-usage")
  @Roles(UserRole.CORPORATE_ADMIN)
  async getCardUsage(@CurrentUser() user: any) {
    return this.reportsService.getCardUsage(user.tenantId);
  }

  @Get("hotel-performance")
  @Roles(UserRole.SUPER_ADMIN)
  async getHotelPerformance() {
    return this.reportsService.getHotelPerformance();
  }

  @Get("budget-utilization")
  @Roles(UserRole.CORPORATE_ADMIN)
  async getBudgetUtilization(@CurrentUser() user: any) {
    return this.reportsService.getBudgetUtilization(user.tenantId);
  }

  @Get("employee-spending")
  @Roles(UserRole.CORPORATE_ADMIN)
  async getEmployeeSpending(@CurrentUser() user: any) {
    return this.reportsService.getEmployeeSpending(user.tenantId);
  }

  @Get("my-usage")
  @Roles(UserRole.CORPORATE_EMPLOYEE)
  async getMyUsage(@CurrentUser() user: any) {
    return this.reportsService.getMyUsage(user.id);
  }

  @Get("provider-summary")
  @Roles(UserRole.HOTEL_OPERATOR)
  async getProviderSummary(@CurrentUser() user: any) {
    return this.reportsService.getProviderSummary(user.serviceProviderId);
  }
}
