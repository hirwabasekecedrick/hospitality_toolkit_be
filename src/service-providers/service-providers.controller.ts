import { Controller, Get, Post, Body, Param, Query, NotFoundException } from "@nestjs/common";
import { ServiceProvidersService } from "./service-providers.service";
import { CreateServiceProviderDto } from "./dto/create-service-provider.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { UserRole } from "@prisma/client";

@Controller("service-providers")
export class ServiceProvidersController {
  constructor(private serviceProvidersService: ServiceProvidersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CORPORATE_ADMIN)
  async create(@Body() dto: CreateServiceProviderDto, @CurrentUser() user: any) {
    return this.serviceProvidersService.create(dto, user.tenantId);
  }

  @Get()
  @Roles(UserRole.CORPORATE_EMPLOYEE, UserRole.CORPORATE_ADMIN, UserRole.HOTEL_OPERATOR, UserRole.SUPER_ADMIN)
  async findAll(@CurrentUser() user: any) {
    // Employees need to see ALL service providers (hotels) to make payments.
    // Only admins managing their own tenant's providers should filter by tenantId.
    const tenantId = (user.role === UserRole.CORPORATE_ADMIN || user.role === UserRole.SUPER_ADMIN)
      ? undefined  // admins see all for management
      : undefined; // employees also see all — hotels are cross-tenant
    return this.serviceProvidersService.findAll(tenantId);
  }

  @Get("my")
  @Roles(UserRole.HOTEL_OPERATOR)
  async findMy(@CurrentUser() user: any) {
    if (!user.serviceProviderId) {
      throw new NotFoundException("No hotel assigned to your account");
    }
    return this.serviceProvidersService.findOne(user.serviceProviderId);
  }

  @Get("code/:code")
  @Roles(UserRole.CORPORATE_EMPLOYEE, UserRole.CORPORATE_ADMIN)
  async findByCode(@Param("code") code: string) {
    return this.serviceProvidersService.findByCode(code);
  }

  @Get(":id")
  @Roles(UserRole.CORPORATE_EMPLOYEE, UserRole.CORPORATE_ADMIN, UserRole.HOTEL_OPERATOR)
  async findOne(@Param("id") id: string) {
    return this.serviceProvidersService.findOne(id);
  }
}
