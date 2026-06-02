import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { BudgetsService } from "./budgets.service";
import { CreateBudgetDto } from "./dto/create-budget.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UserRole } from "@prisma/client";

@Controller("budgets")
@Roles(UserRole.CORPORATE_ADMIN, UserRole.SUPER_ADMIN)
export class BudgetsController {
  constructor(private budgetsService: BudgetsService) {}

  @Post()
  async create(@Body() dto: CreateBudgetDto, @CurrentUser() user: any) {
    return this.budgetsService.create(dto, user.id, user.tenantId);
  }

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.budgetsService.findAll(user.tenantId);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.budgetsService.findOne(id);
  }
}
