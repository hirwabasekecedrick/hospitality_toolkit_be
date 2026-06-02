import { Controller, Get, Post, Put, Delete, Body, Param, Query } from "@nestjs/common";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UserRole } from "@prisma/client";

@Controller("users")
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CORPORATE_ADMIN)
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    const tenantId = user.role === UserRole.SUPER_ADMIN ? dto.role === UserRole.CORPORATE_ADMIN ? undefined : user.tenantId : user.tenantId;
    return this.usersService.create(dto, tenantId || user.tenantId);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CORPORATE_ADMIN)
  async findAll(@Query("role") role: string, @CurrentUser() user: any) {
    return this.usersService.findAll(user.tenantId, role);
  }

  @Get(":id")
  @Roles(UserRole.SUPER_ADMIN, UserRole.CORPORATE_ADMIN)
  async findOne(@Param("id") id: string, @CurrentUser() user: any) {
    return this.usersService.findOne(id, user.tenantId, user.role);
  }

  @Put(":id")
  @Roles(UserRole.SUPER_ADMIN, UserRole.CORPORATE_ADMIN)
  async update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(":id")
  @Roles(UserRole.SUPER_ADMIN, UserRole.CORPORATE_ADMIN)
  async remove(@Param("id") id: string) {
    return this.usersService.remove(id);
  }
}
