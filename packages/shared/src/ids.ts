import { randomUUID } from 'node:crypto'

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`
}

export function createCorrelationId(): string {
  return createId('corr')
}
