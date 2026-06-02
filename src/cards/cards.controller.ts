import { Controller, Get, Post, Put, Delete, Body, Param } from "@nestjs/common";
import { CardsService } from "./cards.service";
import { CreateCardDto } from "./dto/create-card.dto";
import { UpdateCardDto } from "./dto/update-card.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UserRole } from "@prisma/client";

@Controller("cards")
export class CardsController {
  constructor(private cardsService: CardsService) {}

  @Post()
  @Roles(UserRole.CORPORATE_ADMIN, UserRole.SUPER_ADMIN)
  async create(@Body() dto: CreateCardDto, @CurrentUser() user: any) {
    return this.cardsService.create(dto, user.id, user.tenantId);
  }

  @Get()
  @Roles(UserRole.CORPORATE_ADMIN, UserRole.SUPER_ADMIN)
  async findAll(@CurrentUser() user: any) {
    return this.cardsService.findAll(user.tenantId);
  }

  @Get("my")
  @Roles(UserRole.CORPORATE_EMPLOYEE, UserRole.CORPORATE_ADMIN)
  async findMyCards(@CurrentUser() user: any) {
    return this.cardsService.findMyCards(user.id, user.tenantId);
  }

  @Get(":id")
  @Roles(UserRole.CORPORATE_ADMIN, UserRole.SUPER_ADMIN)
  async findOne(@Param("id") id: string, @CurrentUser() user: any) {
    return this.cardsService.findOne(id, user.tenantId, user.role);
  }

  @Put(":id")
  @Roles(UserRole.CORPORATE_ADMIN, UserRole.SUPER_ADMIN)
  async update(@Param("id") id: string, @Body() dto: UpdateCardDto) {
    return this.cardsService.update(id, dto);
  }

  @Delete(":id")
  @Roles(UserRole.CORPORATE_ADMIN, UserRole.SUPER_ADMIN)
  async remove(@Param("id") id: string) {
    return this.cardsService.remove(id);
  }
}
