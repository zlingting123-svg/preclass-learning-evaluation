import { z } from "zod";
import { readFileSync } from "node:fs";
import { requireValue } from "./errors.js";
const positive = z.number().int().positive().safe();
const text = z.string().min(1).max(128);
export const policySchema = z
  .object({
    enabled: z.boolean(),
    dailyRequests: positive,
    dailyUserBudgetMicros: positive,
    monthlyBudgetMicros: positive,
    maxInputBytes: positive.max(32000),
    maxOutputTokens: positive.max(4096),
    reserveMicros: positive,
    maxQueue: positive.max(1000),
    queueTimeoutMs: positive.max(120000),
    requestTimeoutMs: positive.max(180000),
    topicsMinCount: positive.min(2),
    rates: z
      .object({
        inputPerMillion: positive.max(10000000000),
        cacheHitPerMillion: positive.max(10000000000),
        outputPerMillion: positive.max(10000000000),
        currency: z.enum(["CNY", "USD"]),
        version: text,
      })
      .strict(),
  })
  .strict()
  .superRefine((p, ctx) => {
    const minimum = Math.ceil(
      ((p.maxInputBytes + 1024) *
        Math.max(p.rates.inputPerMillion, p.rates.cacheHitPerMillion) +
        p.maxOutputTokens * p.rates.outputPerMillion) /
        1e6,
    );
    if (p.reserveMicros < minimum)
      ctx.addIssue({
        code: "custom",
        message:
          "reserveMicros below configured conservative input/output bound",
      });
  });
export const configSchema = z
  .object({
    mode: z.enum(["mock", "deepseek"]),
    policy: policySchema,
    sources: z
      .array(
        z
          .object({
            id: text,
            scopeId: text,
            topicId: text,
            title: z.string().min(1).max(200),
            content: z.string().min(1).max(20000),
            url: z.string().url().optional(),
            version: text,
            approved: z.boolean(),
            keywords: z.array(z.string().min(1)).min(1),
          })
          .strict(),
      )
      .max(10000),
    courses: z.record(
      text,
      z
        .object({
          keywords: z.array(z.string().min(1)).min(1),
          threshold: z.number().positive().max(1),
        })
        .strict(),
    ),
    grants: z.record(
      text,
      z.record(
        text,
        z
          .object({
            actions: z.array(z.enum(["ask", "topics"])),
            scopeIds: z.array(text).min(1),
          })
          .strict(),
      ),
    ),
    deployments: z
      .array(
        z
          .object({
            id: text,
            accountId: text,
            quotaGroup: text,
            purposes: z
              .array(
                z.enum(["student_qa", "teacher_analytics", "system_admin"]),
              )
              .min(1),
            maxConcurrency: positive.max(1000),
            credentialEnv: z
              .string()
              .regex(/^[A-Z][A-Z0-9_]*$/)
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    balance: z
      .object({
        currency: z.enum(["CNY", "USD"]),
        warningMicros: positive,
        stopMicros: positive,
        ttlMs: positive.max(60000),
      })
      .strict(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.balance.warningMicros <= c.balance.stopMicros)
      ctx.addIssue({
        code: "custom",
        message: "warning must exceed stop threshold",
      });
    if (c.balance.currency !== c.policy.rates.currency)
      ctx.addIssue({
        code: "custom",
        message: "budget and balance currencies differ",
      });
    if (new Set(c.deployments.map((d) => d.id)).size !== c.deployments.length)
      ctx.addIssue({ code: "custom", message: "duplicate deployment id" });
    for (const d of c.deployments)
      if (
        c.deployments.some(
          (x) => x.accountId === d.accountId && x.quotaGroup !== d.quotaGroup,
        )
      )
        ctx.addIssue({
          code: "custom",
          message: "same account must share quotaGroup",
        });
    if (!c.deployments.some((d) => d.purposes.includes("student_qa")))
      ctx.addIssue({ code: "custom", message: "no student deployment" });
  });
export type ModuleConfig = z.infer<typeof configSchema>;
export function readConfig(path: string): ModuleConfig {
  const config = configSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (config.mode === "deepseek") {
    requireValue(
      !/synthetic|mock|sample/i.test(config.policy.rates.version),
      503,
      "REAL_PRICING_REQUIRED",
    );
    requireValue(
      process.env.AI_ENABLE_LIVE === "I_ACCEPT_PAID_API_CALLS",
      503,
      "LIVE_DISABLED",
    );
    requireValue(
      process.env.AI_PROVIDER_POLICY_ACCEPTED === "true",
      503,
      "PROVIDER_POLICY_UNCONFIRMED",
    );
    requireValue(
      process.env.AI_RETRIEVAL_CALIBRATED === "true",
      503,
      "RETRIEVAL_UNCALIBRATED",
    );
    requireValue(config.policy.enabled, 503, "AI_DISABLED");
    for (const d of config.deployments)
      requireValue(
        d.credentialEnv && process.env[d.credentialEnv],
        503,
        "MISSING_PROVIDER_KEY",
      );
  }
  return config;
}
