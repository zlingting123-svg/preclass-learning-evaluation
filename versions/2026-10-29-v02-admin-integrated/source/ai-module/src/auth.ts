import { jwtVerify } from "jose";
import type {
  IdentityResolver,
  CourseAuthorizer,
  Principal,
} from "./contracts.js";
import { ModuleError, requireValue } from "./errors.js";
export function jwtIdentity(options: {
  key: Uint8Array | CryptoKey;
  issuer: string;
  audience: string;
  algorithm: "HS256" | "RS256" | "ES256";
}): IdentityResolver {
  return {
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, options.key, {
          issuer: options.issuer,
          audience: options.audience,
          algorithms: [options.algorithm],
          requiredClaims: ["sub", "exp", "iat", "jti"],
        });
        requireValue(
          typeof payload.sub === "string" &&
            payload.sub.length <= 128 &&
            ["student", "teacher", "admin"].includes(String(payload.role)),
          401,
          "INVALID_IDENTITY",
        );
        return {
          subjectId: payload.sub,
          role: payload.role as Principal["role"],
        };
      } catch {
        throw new ModuleError(401, "INVALID_IDENTITY");
      }
    },
  };
}
/** Merge seam: replace with a live host authorization check. Never accept grants from a browser body. */
export class StaticAuthorization implements CourseAuthorizer {
  constructor(
    readonly grants: Record<
      string,
      Record<string, { actions: ("ask" | "topics")[]; scopeIds: string[] }>
    >,
  ) {}
  async authorize(user: Principal, courseId: string, action: "ask" | "topics") {
    const grant = this.grants[user.subjectId]?.[courseId];
    requireValue(grant?.actions.includes(action), 403, "COURSE_FORBIDDEN");
    return { scopeIds: [...grant.scopeIds] };
  }
}
