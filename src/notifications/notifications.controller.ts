import { Controller, Get, Post, Param } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@Controller("notifications")
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CORPORATE_ADMIN, UserRole.CORPORATE_EMPLOYEE, UserRole.HOTEL_OPERATOR, UserRole.RHA_ADMIN)
  async findAll(@CurrentUser() user: any) {
    return this.notificationsService.findAll(user.id);
  }

  @Get("unread-count")
  @Roles(UserRole.SUPER_ADMIN, UserRole.CORPORATE_ADMIN, UserRole.CORPORATE_EMPLOYEE, UserRole.HOTEL_OPERATOR, UserRole.RHA_ADMIN)
  async getUnreadCount(@CurrentUser() user: any) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  @Post(":id/read")
  @Roles(UserRole.SUPER_ADMIN, UserRole.CORPORATE_ADMIN, UserRole.CORPORATE_EMPLOYEE, UserRole.HOTEL_OPERATOR, UserRole.RHA_ADMIN)
  async markAsRead(@Param("id") id: string, @CurrentUser() user: any) {
    return this.notificationsService.markAsRead(id, user.id);
  }

  @Post("read-all")
  @Roles(UserRole.SUPER_ADMIN, UserRole.CORPORATE_ADMIN, UserRole.CORPORATE_EMPLOYEE, UserRole.HOTEL_OPERATOR, UserRole.RHA_ADMIN)
  async markAllAsRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllAsRead(user.id);
  }
}
