import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly blacklist = new Set<string>();
  private readonly csrfStore = new Map<string, string>();

  constructor() {
    this.logger.log("Using safe zero-dependency in-memory store instead of Redis");
  }

  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    this.blacklist.add(jti);
    // Automatically evict expired items from memory
    setTimeout(() => {
      this.blacklist.delete(jti);
    }, ttlSeconds * 1000);
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    return this.blacklist.has(jti);
  }

  async setCsrf(sessionId: string, token: string): Promise<void> {
    this.csrfStore.set(sessionId, token);
  }

  async getCsrf(sessionId: string): Promise<string | null> {
    return this.csrfStore.get(sessionId) || null;
  }

  onModuleDestroy() {
    this.blacklist.clear();
    this.csrfStore.clear();
  }
}
