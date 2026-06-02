import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import * as bcrypt from "bcrypt";
import { CreateDisputeDto } from "./dto/create-dispute.dto";
import { AuditAction, CardType, CardStatus } from "@prisma/client";
import { DisputeStatus as DisputeStatusEnum } from "@prisma/client";

@Injectable()
export class DisputesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateDisputeDto, userId: string, tenantId?: string) {
    const dispute = await this.prisma.dispute.create({
      data: {
        title: dto.title,
        description: dto.description,
        amount: dto.amount,
        userId,
        transactionId: dto.transactionId,
        tenantId,
      },
    });

    if (dto.transactionId) {
      await this.prisma.transaction.update({
        where: { id: dto.transactionId },
        data: { status: "DISPUTED" as any },
      });
    }

    await this.auditService.log({
      action: AuditAction.DISPUTE,
      entity: "Dispute",
      entityId: dispute.id,
      description: `Dispute created: ${dto.title} for ${dto.amount}`,
      userId,
      tenantId,
    });

    await this.prisma.notification.create({
      data: {
        title: "Dispute opened",
        subtitle: dto.title,
        message: `A dispute for RWF ${dto.amount.toLocaleString()} has been opened.`,
        type: "Dispute",
        actionLabel: "View dispute",
        transactionId: dto.transactionId,
        userId,
      },
    });

    return dispute;
  }

  async findAll(tenantId?: string) {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    return this.prisma.dispute.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async findMyDisputes(userId: string) {
    return this.prisma.dispute.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async resolve(id: string, status: string, resolvedById: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id } });
    if (!dispute) throw new NotFoundException("Dispute not found");

    const resolved = await this.prisma.dispute.update({
      where: { id },
      data: { status: status as any, resolvedAt: new Date(), resolvedById },
    });

    await this.auditService.log({
      action: status === "APPROVED" ? AuditAction.APPROVE : AuditAction.REJECT,
      entity: "Dispute",
      entityId: id,
      description: `Dispute ${status.toLowerCase()}: ${dispute.title}`,
      userId: resolvedById,
      tenantId: dispute.tenantId ?? undefined,
    });

    if (status === "APPROVED" && dispute.amount > 0) {
      await this.addFundsOrCreateCard(dispute, resolvedById);
    }

    return resolved;
  }

  private async addFundsOrCreateCard(dispute: { userId: string; amount: number; tenantId?: string | null; title: string }, resolvedById: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: dispute.userId },
      select: { id: true, firstName: true, lastName: true, email: true, tenantId: true },
    });
    if (!user) return;

    const tenantId = dispute.tenantId || user.tenantId;

    const activeCard = await this.prisma.card.findFirst({
      where: {
        status: CardStatus.ACTIVE,
        tenantId,
        OR: [
          { employees: { some: { employeeId: dispute.userId } } },
          { teamLeaderId: dispute.userId },
        ],
      },
    });

    if (activeCard) {
      if (activeCard.type === CardType.PER_DIEM) {
        await this.prisma.card.update({
          where: { id: activeCard.id },
          data: { amount: { increment: dispute.amount } },
        });
      } else {
        await this.prisma.card.update({
          where: { id: activeCard.id },
          data: { limit: { increment: dispute.amount } },
        });
      }

      await this.prisma.notification.create({
        data: {
          title: "Dispute approved — funds added",
          subtitle: dispute.title,
          message: `Your dispute for RWF ${dispute.amount.toLocaleString()} has been approved and added to your card ****${activeCard.last4}.`,
          type: "Dispute",
          userId: dispute.userId,
        },
      });
    } else {
      const cardPassword = await bcrypt.hash("card1234", 10);
      const cardNumber = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join("");
      const last4 = cardNumber.slice(-4);

      const newCard = await this.prisma.card.create({
        data: {
          type: CardType.PER_DIEM,
          status: CardStatus.ACTIVE,
          cardPassword,
          cardNumber,
          last4,
          amount: dispute.amount,
          spent: 0,
          validityType: "SINGLE" as any,
          purpose: `Auto-created from dispute approval: ${dispute.title}`,
          tenantId,
          createdById: resolvedById,
        },
      });

      await this.prisma.cardEmployee.create({
        data: { cardId: newCard.id, employeeId: dispute.userId },
      });

      await this.prisma.notification.create({
        data: {
          title: "Dispute approved — new card issued",
          subtitle: dispute.title,
          message: `Your dispute for RWF ${dispute.amount.toLocaleString()} has been approved. A new card ****${last4} has been issued to you with that amount.`,
          type: "Dispute",
          userId: dispute.userId,
        },
      });
    }
  }
}
