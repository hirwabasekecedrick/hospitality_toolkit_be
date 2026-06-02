import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { TenantsService } from "./tenants.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@Controller("tenants")
@Roles(UserRole.SUPER_ADMIN)
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Post()
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  async findAll() {
    return this.tenantsService.findAll();
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.tenantsService.findOne(id);
  }
}
