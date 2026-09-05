import type { Redis } from 'ioredis'
import type { ActiveSessionState, TranscriptSpeaker } from '@nexoprep/types'

export interface MemoryServiceOptions {
  sessionTtlSeconds: number
  transcriptBufferTtlSeconds: number
}

export class MemoryService {
  constructor(
    private readonly redis: Redis,
    private readonly options: MemoryServiceOptions,
  ) {}

  async saveActiveSession(state: ActiveSessionState): Promise<void> {
    await this.redis.set(this.sessionKey(state.sessionId), JSON.stringify(state), 'EX', this.options.sessionTtlSeconds)
    await this.redis.sadd(this.userSessionsKey(state.userId), state.sessionId)
    await this.redis.expire(this.userSessionsKey(state.userId), this.options.sessionTtlSeconds)
  }

  async getActiveSession(sessionId: string): Promise<ActiveSessionState | null> {
    const raw = await this.redis.get(this.sessionKey(sessionId))
    return raw ? (JSON.parse(raw) as ActiveSessionState) : null
  }

  async clearActiveSession(sessionId: string, userId?: string): Promise<void> {
    await this.redis.del(this.sessionKey(sessionId), this.transcriptBufferKey(sessionId), this.speakerKey(sessionId))
    if (userId) await this.redis.srem(this.userSessionsKey(userId), sessionId)
  }

  async setActiveSpeaker(sessionId: string, speaker: TranscriptSpeaker): Promise<void> {
    await this.redis.set(this.speakerKey(sessionId), speaker, 'EX', this.options.sessionTtlSeconds)
  }

  async getActiveSpeaker(sessionId: string): Promise<TranscriptSpeaker | null> {
    return (await this.redis.get(this.speakerKey(sessionId))) as TranscriptSpeaker | null
  }

  async bufferTranscript(sessionId: string, entry: { sequence: number; speaker: string; content: string; receivedAt: string }): Promise<void> {
    await this.redis
      .multi()
      .rpush(this.transcriptBufferKey(sessionId), JSON.stringify(entry))
      .expire(this.transcriptBufferKey(sessionId), this.options.transcriptBufferTtlSeconds)
      .exec()
  }

  async readTranscriptBuffer(sessionId: string): Promise<Array<{ sequence: number; speaker: string; content: string; receivedAt: string }>> {
    const entries = await this.redis.lrange(this.transcriptBufferKey(sessionId), 0, -1)
    return entries.map((entry: string) => JSON.parse(entry) as { sequence: number; speaker: string; content: string; receivedAt: string })
  }

  private sessionKey(sessionId: string): string {
    return `nexoprep:session:${sessionId}`
  }

  private speakerKey(sessionId: string): string {
    return `nexoprep:session:${sessionId}:speaker`
  }

  private transcriptBufferKey(sessionId: string): string {
    return `nexoprep:session:${sessionId}:transcripts`
  }

  private userSessionsKey(userId: string): string {
    return `nexoprep:user:${userId}:active_sessions`
  }
}
