import { randomBytes } from "crypto";

export function generateTransactionReference(): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `TX-${suffix}`;
}

export function generateExchangeReference(): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `FX-${suffix}`;
}
