export class ModuleError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
export function requireValue(
  value: unknown,
  status: number,
  code: string,
): asserts value {
  if (!value) throw new ModuleError(status, code);
}
