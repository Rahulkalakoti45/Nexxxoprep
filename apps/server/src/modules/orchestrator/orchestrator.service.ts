import type { ConversationMemory } from '../conversation/memory.service.js'
import type { GeminiMessage } from './gemini.service.js'
import { GeminiService } from './gemini.service.js'
import { CandidateProfileService } from './candidate-profile.service.js'
import { QuestionDiversityService } from './question-diversity.service.js'
import { buildInterviewerSystemPrompt, buildPromptContextSnapshot } from './prompts/interviewer.prompt.js'

export class OrchestratorService {
  constructor(
    private readonly gemini: GeminiService,
    private readonly candidateProfileService: CandidateProfileService,
    private readonly questionDiversityService: QuestionDiversityService,
  ) {}

  buildSystemPrompt(memory: ConversationMemory): string {
    return buildInterviewerSystemPrompt(memory, {
      candidateProfileService: this.candidateProfileService,
      questionDiversityService: this.questionDiversityService,
      followUp: memory.lastFollowUp,
    })
  }

  getPromptContext(memory: ConversationMemory) {
    return {
      snapshot: buildPromptContextSnapshot(memory),
      systemPromptPreview: this.buildSystemPrompt(memory).slice(0, 2000),
    }
  }

  toGeminiMessages(openAiMessages: Array<{ role: string; content: string }>): GeminiMessage[] {
    return openAiMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))
  }

  extractQuestion(text: string): string | null {
    const trimmed = text.trim()
    const match = trimmed.match(/[^.?!]*\?/)
    return match ? match[0].trim() : null
  }

  streamResponse(memory: ConversationMemory, openAiMessages: Array<{ role: string; content: string }>) {
    const systemPrompt = this.buildSystemPrompt(memory)
    const messages = this.toGeminiMessages(openAiMessages)
    console.log('[GEMINI_REQUEST_START]', {
      source: 'orchestrator.streamResponse',
      openAiMessageCount: openAiMessages.length,
      openAiRoles: openAiMessages.map((message) => message.role),
      geminiMessageCount: messages.length,
      geminiRoles: messages.map((message) => message.role),
      systemPromptLength: systemPrompt.length,
    })
    return this.gemini.streamGenerate(systemPrompt, messages)
  }
}
