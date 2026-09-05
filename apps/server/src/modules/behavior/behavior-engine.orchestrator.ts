import type { FastifyBaseLogger } from 'fastify'
import type { EventBus } from '@nexoprep/events'
import type { RealtimeEvent, RealtimeEventPayloads } from '@nexoprep/types'
import type { BehaviorEngineService } from './behavior-engine.service.js'

/**
 * BehaviorEngineOrchestrator
 *
 * Wires the Behavior Engine into the interview lifecycle purely by
 * listening to the existing realtime event bus (SESSION_STARTED /
 * SESSION_UPDATED). It never calls into SessionService directly and
 * SessionService never calls into it — this preserves Rule 1
 * (Interview Engine and Behavior Engine remain completely independent)
 * and Rule 7 (extend, never rewrite working code): session-service's
 * createSession()/updateState() are untouched by this integration.
 *
 * A thrown/rejected handler here is caught and logged, never propagated —
 * satisfying "Behavior Engine may fail without affecting Interview Engine".
 */
export class BehaviorEngineOrchestrator {
  private unsubscribe: (() => Promise<void>) | null = null

  constructor(
    private readonly behaviorEngine: BehaviorEngineService,
    private readonly eventBus: EventBus,
    private readonly logger: FastifyBaseLogger,
  ) {}

  async start(): Promise<void> {
    if (!this.behaviorEngine.isEnabled()) {
      this.logger.info('[BEHAVIOR_ENGINE_DISABLED] orchestrator not subscribing to session events')
      return
    }
    this.unsubscribe = await this.eventBus.subscribe((event) => this.handleEvent(event))
    this.logger.info('[BEHAVIOR_ENGINE_READY] orchestrator subscribed to session lifecycle events')
  }

  async stop(): Promise<void> {
    if (this.unsubscribe) {
      await this.unsubscribe()
      this.unsubscribe = null
    }
    this.behaviorEngine.stopAll()
  }

  private async handleEvent(event: RealtimeEvent): Promise<void> {
    try {
      if (event.type === 'SESSION_STARTED') {
        const payload = event.payload as RealtimeEventPayloads['SESSION_STARTED']
        await this.behaviorEngine.start(payload.sessionId)
        return
      }

      if (event.type === 'SESSION_UPDATED') {
        const payload = event.payload as RealtimeEventPayloads['SESSION_UPDATED']
        if (payload.state.status === 'completed') {
          this.behaviorEngine.stop(payload.sessionId)
        }
        return
      }
    } catch (error) {
      // A Behavior Engine integration failure must never affect the
      // interview lifecycle itself.
      this.logger.error({ error, eventType: event.type }, '[BEHAVIOR_ENGINE_ERROR] orchestrator handler failed')
    }
  }
}
