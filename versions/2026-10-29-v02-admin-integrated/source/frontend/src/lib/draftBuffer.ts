import type { Answer, SubmitRequest } from '@shared/contracts'

export interface DraftBuffer {
  answers: Answer[]
  version: number
  dirty: boolean
  pending: { key: string; input: SubmitRequest } | null
}
// Same-tab memory only; no localStorage, tokens or cross-user draft sharing.
const buffers = new Map<string, DraftBuffer>()
export const bufferKey = (userId: string, assignmentId: string) => JSON.stringify([userId, assignmentId])
export function readBuffer(key: string): DraftBuffer | undefined { return buffers.get(key) }
export function writeBuffer(key: string, value: DraftBuffer): void { buffers.set(key, structuredClone(value)) }
export function removeBuffer(key: string): void { buffers.delete(key) }
export function clearBuffers(): void { buffers.clear() }
