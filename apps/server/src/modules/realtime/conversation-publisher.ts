import type { EventBus } from '@nexoprep/events'
import type { RealtimeEventType } from '@nexoprep/types'

export class ConversationPublisher {
  constructor(private readonly events: EventBus) {}

  async publish<TType extends RealtimeEventType>(
    type: TType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.events.publish(this.events.create(type, payload as never))
    } catch {
      // Non-blocking fan-out
    }
  }
}
