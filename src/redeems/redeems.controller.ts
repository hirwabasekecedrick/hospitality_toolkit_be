import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { RedeemsService } from "./redeems.service";
import { CreateRedeemDto } from "./dto/create-redeem.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UserRole } from "@prisma/client";

@Controller("redeems")
@Roles(UserRole.HOTEL_OPERATOR, UserRole.SUPER_ADMIN)
export class RedeemsController {
  constructor(private redeemsService: RedeemsService) {}

  @Post()
  async create(@Body() dto: CreateRedeemDto, @CurrentUser() user: any) {
    return this.redeemsService.create(dto, user.id, user.tenantId);
  }

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.redeemsService.findAll(user.tenantId);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.redeemsService.findOne(id);
  }
}
