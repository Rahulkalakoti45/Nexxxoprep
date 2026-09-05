import { EventEmitter } from 'node:events'
import { createId } from '@nexoprep/shared'
import type { EventPublisher, EventSubscriber, RealtimeEvent, RealtimeEventPayloads, RealtimeEventType } from '@nexoprep/types'

export interface EventBus extends EventPublisher, EventSubscriber {
  create<TType extends RealtimeEventType>(
    type: TType,
    payload: RealtimeEventPayloads[TType],
    options?: Partial<Pick<RealtimeEvent<TType>, 'correlationId' | 'severity'>>,
  ): RealtimeEvent<TType>
}

export class InMemoryEventBus implements EventBus {
  private readonly emitter = new EventEmitter()

  create<TType extends RealtimeEventType>(
    type: TType,
    payload: RealtimeEventPayloads[TType],
    options: Partial<Pick<RealtimeEvent<TType>, 'correlationId' | 'severity'>> = {},
  ): RealtimeEvent<TType> {
    return {
      id: createId('evt'),
      type,
      occurredAt: new Date().toISOString(),
      severity: options.severity ?? 'info',
      correlationId: options.correlationId,
      payload,
    }
  }

  async publish<TType extends RealtimeEventType>(event: RealtimeEvent<TType>): Promise<void> {
    this.emitter.emit('event', event)
  }

  async subscribe(handler: (event: RealtimeEvent) => Promise<void> | void): Promise<() => Promise<void>> {
    this.emitter.on('event', handler)
    return async () => {
      this.emitter.off('event', handler)
    }
  }
}
