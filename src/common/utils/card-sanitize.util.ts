/** Strip sensitive card fields before API responses. Never expose full number, CVV, or PIN. */
export function sanitizeCard<T extends Record<string, unknown>>(card: T): Omit<T, "cardNumber" | "cardPassword"> {
  const { cardNumber: _n, cardPassword: _p, ...safe } = card;
  return safe;
}

export function sanitizeCards<T extends Record<string, unknown>>(cards: T[]) {
  return cards.map(sanitizeCard);
}
