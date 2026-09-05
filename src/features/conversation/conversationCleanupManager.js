class ConversationCleanupManager {
  constructor() {
    this.active = null
  }

  setActive(active) {
    this.active = active
  }

  clearActive(sessionId) {
    if (!this.active) return
    if (!sessionId || this.active.sessionId === sessionId) {
      this.active = null
    }
  }

  async cleanup(reason = 'unknown') {
    if (!this.active) return
    const { sessionId, conversation, micProbeStream, timers = [], listeners = [], onAfterCleanup } = this.active
    try {
      console.info('[conversation] cleanup:start', { sessionId, reason })
      listeners.forEach(({ target, event, handler }) => target?.removeEventListener?.(event, handler))
      timers.forEach((timer) => clearTimeout(timer))
      if (micProbeStream) {
        micProbeStream.getTracks().forEach((track) => track.stop())
      }
      if (conversation) {
        await conversation.endSession()
      }
      if (onAfterCleanup) {
        await onAfterCleanup()
      }
      console.info('[conversation] cleanup:done', { sessionId, reason })
    } catch (error) {
      console.warn('[conversation] cleanup:error', { sessionId, reason, error: error?.message })
    } finally {
      this.active = null
    }
  }
}

export const conversationCleanupManager = new ConversationCleanupManager()
