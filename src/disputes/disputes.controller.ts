import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { DisputesService } from "./disputes.service";
import { CreateDisputeDto } from "./dto/create-dispute.dto";
import { ResolveDisputeDto } from "./dto/resolve-dispute.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@Controller("disputes")
export class DisputesController {
  constructor(private disputesService: DisputesService) {}

  @Post()
  @Roles(UserRole.CORPORATE_EMPLOYEE, UserRole.CORPORATE_ADMIN, UserRole.HOTEL_OPERATOR)
  async create(@Body() dto: CreateDisputeDto, @CurrentUser() user: any) {
    return this.disputesService.create(dto, user.id, user.tenantId);
  }

  @Get()
  @Roles(UserRole.CORPORATE_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOTEL_OPERATOR)
  async findAll(@CurrentUser() user: any) {
    return this.disputesService.findAll(user.tenantId);
  }

  @Get("my")
  @Roles(UserRole.CORPORATE_EMPLOYEE)
  async findMyDisputes(@CurrentUser() user: any) {
    return this.disputesService.findMyDisputes(user.id);
  }

  @Post(":id/resolve")
  @Roles(UserRole.CORPORATE_ADMIN, UserRole.SUPER_ADMIN)
  async resolve(@Param("id") id: string, @Body() dto: ResolveDisputeDto, @CurrentUser() user: any) {
    return this.disputesService.resolve(id, dto.status, user.id);
  }
}
