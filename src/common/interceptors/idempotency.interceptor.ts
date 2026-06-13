import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException } from "@nestjs/common";
import { Observable, of } from "rxjs";
import { tap } from "rxjs/operators";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Only apply to state-changing methods
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      return next.handle();
    }

    const idempotencyKey = request.headers["x-idempotency-key"];
    if (!idempotencyKey) {
      // For now, we allow requests without idempotency keys to pass through
      // In a strict environment, you would throw a BadRequestException here
      return next.handle();
    }

    // Check if key already exists in the database
    const existingKey = await this.prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (existingKey) {
      // If found, return the cached response immediately
      response.status(existingKey.responseStatus);
      return of(existingKey.responseBody);
    }

    // Process the request normally and catch the response
    return next.handle().pipe(
      tap(async (data) => {
        try {
          const userId = request.user?.sub || request.user?.id || null;
          
          await this.prisma.idempotencyKey.create({
            data: {
              key: idempotencyKey,
              userId,
              requestPath: request.url,
              requestMethod: request.method,
              responseStatus: response.statusCode || 200,
              responseBody: data ? data : {},
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours expiry
            },
          });
        } catch (err) {
          // Log error but don't fail the request if cache write fails
          console.error("Failed to save idempotency key:", err);
        }
      })
    );
  }
}
