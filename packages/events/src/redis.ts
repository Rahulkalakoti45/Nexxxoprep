import { Redis } from 'ioredis'
import { InMemoryEventBus } from './event-bus.js'
import type { RealtimeEvent, RealtimeEventType } from '@nexoprep/types'

const CHANNEL = 'nexoprep:events:realtime'

export interface RedisEventBusOptions {
  redisUrl: string
  streamMaxLen: number
}

export class RedisEventBus extends InMemoryEventBus {
  private readonly publisher: Redis
  private readonly subscriber: Redis

  constructor(private readonly options: RedisEventBusOptions) {
    super()
    this.publisher = new Redis(options.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 })
    this.subscriber = new Redis(options.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 })
  }

  async connect(): Promise<void> {
    await Promise.all([this.publisher.connect(), this.subscriber.connect()])
    await this.subscriber.subscribe(CHANNEL)
    this.subscriber.on('message', (_channel: string, message: string) => {
      const event = JSON.parse(message) as RealtimeEvent
      void super.publish(event)
    })
  }

  async publish<TType extends RealtimeEventType>(event: RealtimeEvent<TType>): Promise<void> {
    const serialized = JSON.stringify(event)
    await this.publisher
      .multi()
      .publish(CHANNEL, serialized)
      .xadd('nexoprep:events:stream', 'MAXLEN', '~', this.options.streamMaxLen, '*', 'event', serialized)
      .exec()
  }

  async disconnect(): Promise<void> {
    await Promise.allSettled([this.publisher.quit(), this.subscriber.quit()])
  }
}

export function createRedisClient(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  })
}
