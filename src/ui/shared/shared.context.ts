export const ContextKey = {
  EMAIL: 'email',
  OTP: 'otp',
} as const;

type ContextKey = (typeof ContextKey)[keyof typeof ContextKey];

export class SharedContext {
  private readonly store = new Map<ContextKey, unknown>();

  set<T>(key: ContextKey, value: T): void {
    this.store.set(key, value);
  }

  get<T>(key: ContextKey): T {
    const value = this.store.get(key);
    if (value === undefined) throw new Error(`SharedContext: "${key}" not found`);
    return value as T;
  }

  has(key: ContextKey): boolean {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
  }
}
