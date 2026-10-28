import type {
  ModelProvider,
  ProviderEvent,
  UpstreamInput,
} from "./contracts.js";
/** No network calls; test-only implementation injected explicitly. */
export class MockProvider implements ModelProvider {
  readonly model = "mock-only";
  calls = 0;
  active = 0;
  peak = 0;
  constructor(
    readonly mode: "ok" | "broken" = "ok",
    readonly delayMs = 1,
  ) {}
  async *stream(input: UpstreamInput): AsyncGenerator<ProviderEvent> {
    this.calls++;
    this.active++;
    this.peak = Math.max(this.peak, this.active);
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, this.delayMs);
        const abort = () => {
          clearTimeout(timer);
          reject(new Error("cancelled"));
        };
        if (input.signal.aborted) abort();
        else input.signal.addEventListener("abort", abort, { once: true });
      });
      yield {
        type: "delta",
        text: `【本地替身测试，不是真实AI回答】环境评价需结合课程资料分析。[${input.evidence[0]?.id ?? "no-source"}]`,
      };
      if (this.mode === "broken") return;
      yield {
        type: "usage",
        usage: { inputTokens: 100, outputTokens: 30, cacheHitTokens: 0 },
      };
      yield { type: "finish", reason: "stop" };
    } finally {
      this.active--;
    }
  }
}
