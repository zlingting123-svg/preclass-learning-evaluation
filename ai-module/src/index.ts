// Public merge boundary: host supplies identity, membership, retrieval, deployment and ledger config.
export * from "./contracts.js";
export { Gateway } from "./gateway.js";
export { createModuleApp } from "./app.js";
export { Ledger } from "./ledger.js";
export { jwtIdentity, StaticAuthorization } from "./auth.js";
export { KeywordKnowledge } from "./knowledge.js";
export { DeepSeekProvider } from "./deepseek.js";
export { BalanceMonitor } from "./balance.js";
export { Scheduler } from "./scheduler.js";
export { configSchema, policySchema, readConfig } from "./config.js";

export type { BillingStore, Entry } from "./ledger.js";
export type { AdmissionScheduler, Lease } from "./scheduler.js";

export { MockProvider } from "./mock.js";
export { ModuleError } from "./errors.js";
