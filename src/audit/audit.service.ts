import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditAction } from "@prisma/client";



@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    action: AuditAction;
    entity: string;
    entityId?: string;
    description?: string;
    oldValue?: any;
    newValue?: any;
    userId?: string;
    tenantId?: string;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        description: params.description,
        oldValue: params.oldValue ?? undefined,
        newValue: params.newValue ?? undefined,
        userId: params.userId,
        tenantId: params.tenantId,
        ipAddress: params.ipAddress,
      },
    });
  }

  async findAll(params: {
    tenantId?: string;
    skip?: number;
    take?: number;
  }) {
    const where: any = {};
    if (params.tenantId) where.tenantId = params.tenantId;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}
