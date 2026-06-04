import { Injectable, NotFoundException, ForbiddenException, UnauthorizedException, BadRequestException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateCardDto } from "./dto/create-card.dto";
import { UpdateCardDto } from "./dto/update-card.dto";
import { ChangeCardPasswordDto } from "./dto/change-card-password.dto";
import { AuditAction, CardType } from "@prisma/client";

@Injectable()
export class CardsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private generateCardNumber(): { cardNumber: string; last4: string } {
    const cardNumber = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join("");
    const last4 = cardNumber.slice(-4);
    return { cardNumber, last4 };
  }

  private generateDefaultPassword(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  async create(dto: CreateCardDto, createdById: string, tenantId: string) {
    const { cardNumber, last4 } = this.generateCardNumber();
    const plainPassword = dto.cardPassword || this.generateDefaultPassword();
    const cardPassword = await bcrypt.hash(plainPassword, 10);

    const card = await this.prisma.card.create({
      data: {
        type: dto.type,
        cardPassword,
        cardNumber,
        last4,
        limit: dto.limit,
        amount: dto.amount,
        validityType: dto.validityType,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        purpose: dto.purpose,
        distributed: dto.distributed ?? false,
        teamLeaderId: dto.teamLeaderId,
        tenantId,
        createdById,
        budgetId: dto.budgetId,
      },
    });

    if (dto.employeeIds && dto.employeeIds.length > 0) {
      await this.prisma.cardEmployee.createMany({
        data: dto.employeeIds.map((employeeId) => ({
          cardId: card.id,
          employeeId,
        })),
      });

      for (const employeeId of dto.employeeIds) {
        await this.prisma.notification.create({
          data: {
            title: "New card issued",
            subtitle: `A new ${dto.type} card has been assigned to you.`,
            message: `A ${dto.type === "PER_DIEM" ? "per diem" : "corporate expense"} card ****${last4} has been issued. Default password: ${plainPassword}. Please change it before first use.`,
            type: "Card",
            actionLabel: "View cards",
            actionUrl: "/corporate_employee",
            userId: employeeId,
          },
        });
      }
    }

    if (dto.teamLeaderId) {
      await this.prisma.notification.create({
        data: {
          title: "Card issued to your team",
          subtitle: `A ${dto.type} card ****${last4} has been issued.`,
          message: `A ${dto.type === "PER_DIEM" ? "per diem" : "corporate expense"} card ****${last4} has been issued for your team. Purpose: ${dto.purpose || "N/A"}.`,
          type: "Card",
          actionLabel: "View cards",
          actionUrl: "/corporate_employee",
          userId: dto.teamLeaderId,
        },
      });
    }

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: "Card",
      entityId: card.id,
      description: `Card created: ${dto.type} for ${dto.purpose || "N/A"}`,
      userId: createdById,
      tenantId,
    });

    const result = await this.findOne(card.id, tenantId, "CORPORATE_ADMIN");
    return { ...result, defaultPassword: plainPassword };
  }

  async findAll(tenantId: string) {
    return this.prisma.card.findMany({
      where: { tenantId },
      include: {
        employees: { include: { employee: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        teamLeader: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, requestingTenantId?: string, requestingRole?: string) {
    const card = await this.prisma.card.findUnique({
      where: { id },
      include: {
        employees: { include: { employee: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        teamLeader: { select: { id: true, firstName: true, lastName: true, email: true } },
        transactions: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!card) throw new NotFoundException("Card not found");
    if (requestingRole !== "SUPER_ADMIN" && card.tenantId !== requestingTenantId) {
      throw new UnauthorizedException("You do not have access to this card");
    }
    return card;
  }

  async findMyCards(userId: string, tenantId: string) {
    return this.prisma.card.findMany({
      where: {
        tenantId,
        OR: [
          { teamLeaderId: userId },
          { employees: { some: { employeeId: userId } } },
        ],
      },
      include: {
        employees: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } },
        teamLeader: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async update(id: string, dto: UpdateCardDto) {
    const card = await this.prisma.card.findUnique({ where: { id } });
    if (!card) throw new NotFoundException("Card not found");

    const updated = await this.prisma.card.update({
      where: { id },
      data: {
        status: dto.status,
        limit: dto.limit,
        amount: dto.amount,
        purpose: dto.purpose,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
    });

    return updated;
  }

  async remove(id: string) {
    const card = await this.prisma.card.findUnique({ where: { id } });
    if (!card) throw new NotFoundException("Card not found");

    await this.prisma.card.update({
      where: { id },
      data: { status: "CANCELLED" as any },
    });

    return { message: "Card cancelled successfully" };
  }

  async changePassword(userId: string, dto: ChangeCardPasswordDto) {
    const card = await this.prisma.card.findUnique({
      where: { id: dto.cardId },
      include: { employees: true },
    });

    if (!card) throw new NotFoundException("Card not found");

    const isAssigned = card.employees.some((e) => e.employeeId === userId);
    const isTeamLeader = card.teamLeaderId === userId;
    if (!isAssigned && !isTeamLeader) {
      throw new ForbiddenException("You are not assigned to this card");
    }

    const isOldPasswordValid = await bcrypt.compare(dto.oldPassword, card.cardPassword);
    if (!isOldPasswordValid) throw new BadRequestException("Current card password is incorrect");

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.card.update({
      where: { id: dto.cardId },
      data: { cardPassword: newPasswordHash },
    });

    return { message: "Card password changed successfully" };
  }

  async validateCardForPayment(cardId: string, password: string, amount: number, userId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: {
        employees: true,
        teamLeader: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!card) throw new NotFoundException("Card not found");
    if (card.status !== "ACTIVE") throw new ForbiddenException("Card is not active");

    if (card.limit && card.spent + amount > card.limit) throw new ForbiddenException("Card limit exceeded");

    if (card.type === CardType.CORPORATE_EXPENSE) {
      const isTeamLeader = card.teamLeaderId === userId;
      const isAssigned = card.employees.some((e) => e.employeeId === userId);
      if (!isTeamLeader && !isAssigned) {
        throw new ForbiddenException("You are not assigned to this corporate expense card");
      }
    }

    if (card.type === CardType.PER_DIEM) {
      const isAssigned = card.employees.some((e) => e.employeeId === userId);
      if (!isAssigned && card.teamLeaderId !== userId) {
        throw new ForbiddenException("You are not assigned to this card");
      }
    }

    const isPasswordValid = await bcrypt.compare(password, card.cardPassword);
    if (!isPasswordValid) throw new ForbiddenException("Invalid card password");

    return card;
  }
}
