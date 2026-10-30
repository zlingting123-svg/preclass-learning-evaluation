import type { Deployment } from "./contracts.js";
import { ModuleError, requireValue } from "./errors.js";
export class BalanceMonitor {
  private values = new Map<
    string,
    {
      expires: number;
      value?: { currency: string; balance: string; available: boolean };
      error?: boolean;
    }
  >();
  private running = new Map<string, Promise<void>>();
  constructor(
    readonly settings: {
      currency: string;
      warningMicros: number;
      stopMicros: number;
      ttlMs: number;
    },
  ) {}
  async inspect(d: Deployment, signal: AbortSignal) {
    if (!d.provider.balance)
      return { accountId: d.accountId, state: "not_supported" };
    if ((this.values.get(d.accountId)?.expires ?? 0) < Date.now()) {
      if (!this.running.has(d.accountId)) {
        const pending = (async () => {
          try {
            const value = await d.provider.balance!(AbortSignal.timeout(5000));
            this.values.set(d.accountId, {
              expires: Date.now() + this.settings.ttlMs,
              value,
            });
          } catch {
            this.values.set(d.accountId, {
              expires: Date.now() + this.settings.ttlMs,
              error: true,
            });
          }
        })().finally(() => this.running.delete(d.accountId));
        this.running.set(d.accountId, pending);
      }
      await this.running.get(d.accountId);
    }
    signal.throwIfAborted();
    const cache = this.values.get(d.accountId);
    if (!cache?.value) throw new ModuleError(503, "BALANCE_UNKNOWN");
    const v = cache.value;
    requireValue(
      v.currency === this.settings.currency,
      503,
      "BALANCE_CURRENCY_MISMATCH",
    );
    const micros = Math.floor(Number(v.balance) * 1e6);
    requireValue(Number.isSafeInteger(micros), 503, "BALANCE_INVALID");
    return {
      accountId: d.accountId,
      currency: v.currency,
      balance: v.balance,
      checkedAt: new Date(cache.expires - this.settings.ttlMs).toISOString(),
      state:
        !v.available || micros <= this.settings.stopMicros
          ? "stopped"
          : micros <= this.settings.warningMicros
            ? "warning"
            : "ok",
    };
  }
  async admit(d: Deployment, signal: AbortSignal) {
    const state = await this.inspect(d, signal);
    requireValue(
      state.state === "ok" || state.state === "warning",
      503,
      "BALANCE_STOPPED",
    );
  }
}
