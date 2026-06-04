import { Injectable, OnModuleDestroy } from "@nestjs/common";

@Injectable()
export class TokenBlacklistService implements OnModuleDestroy {
  private readonly blacklist = new Set<string>();

  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    this.blacklist.add(jti);
    setTimeout(() => { this.blacklist.delete(jti); }, ttlSeconds * 1000);
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    return this.blacklist.has(jti);
  }

  onModuleDestroy() {
    this.blacklist.clear();
  }
}
