import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
const root = resolve("work/sample");
mkdirSync(root, { recursive: true, mode: 0o700 });
const secret = resolve(root, "auth.secret"),
  fp = resolve(root, "fingerprint.secret");
if (!existsSync(secret))
  writeFileSync(secret, randomBytes(32), { mode: 0o600 });
if (!existsSync(fp))
  writeFileSync(fp, randomBytes(32).toString("hex"), { mode: 0o600 });
const config = {
  mode: "mock",
  policy: {
    enabled: true,
    dailyRequests: 20,
    dailyUserBudgetMicros: 1000000,
    monthlyBudgetMicros: 10000000,
    maxInputBytes: 12000,
    maxOutputTokens: 512,
    reserveMicros: 2000,
    maxQueue: 600,
    queueTimeoutMs: 30000,
    requestTimeoutMs: 60000,
    topicsMinCount: 3,
    rates: {
      inputPerMillion: 10000,
      cacheHitPerMillion: 1000,
      outputPerMillion: 20000,
      currency: "CNY",
      version: "synthetic-not-real-price",
    },
  },
  balance: {
    currency: "CNY",
    warningMicros: 10000000,
    stopMicros: 1000000,
    ttlMs: 15000,
  },
  deployments: [
    {
      id: "mock-deployment",
      accountId: "mock-account",
      quotaGroup: "mock-account",
      purposes: ["student_qa"],
      maxConcurrency: 350,
    },
  ],
  courses: { environment: { keywords: ["环境", "环评"], threshold: 0.5 } },
  sources: [
    {
      id: "example-environment",
      scopeId: "environment-course",
      topicId: "assessment_basics",
      title: "虚构测试课程资料（非正式教学材料）",
      content:
        "环境评价的课程练习关注项目可能造成的影响，以及支持判断所需的资料与依据。",
      version: "sample-1",
      approved: true,
      keywords: ["环境", "评价"],
    },
  ],
  grants: {
    "student-demo": {
      environment: { actions: ["ask"], scopeIds: ["environment-course"] },
    },
    "teacher-demo": {
      environment: { actions: ["topics"], scopeIds: ["environment-course"] },
    },
  },
};
if (!existsSync(resolve(root, "config.json")))
  writeFileSync(resolve(root, "config.json"), JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
const tokens: Record<string, string> = {};
for (const [subject, role] of [
  ["student-demo", "student"],
  ["teacher-demo", "teacher"],
  ["admin-demo", "admin"],
])
  tokens[role] = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuer("course-platform")
    .setAudience("course-ai")
    .setJti(randomBytes(16).toString("hex"))
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(readFileSync(secret));
writeFileSync(resolve(root, "tokens.json"), JSON.stringify(tokens, null, 2), {
  mode: 0o600,
});
console.log(
  "已准备纯替身样板。令牌仅在work/sample/tokens.json，8小时有效；再次setup可刷新，不会覆盖配置。",
);
