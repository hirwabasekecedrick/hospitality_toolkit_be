import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { TenantsModule } from "./tenants/tenants.module";
import { CardsModule } from "./cards/cards.module";
import { PaymentsModule } from "./payments/payments.module";
import { ServiceProvidersModule } from "./service-providers/service-providers.module";
import { DisputesModule } from "./disputes/disputes.module";
import { RedeemsModule } from "./redeems/redeems.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AuditModule } from "./audit/audit.module";
import { RedisModule } from "./redis/redis.module";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { RolesGuard } from "./auth/guards/roles.guard";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    CardsModule,
    PaymentsModule,
    ServiceProvidersModule,
    DisputesModule,
    RedeemsModule,
    NotificationsModule,
    AuditModule,
    RedisModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
