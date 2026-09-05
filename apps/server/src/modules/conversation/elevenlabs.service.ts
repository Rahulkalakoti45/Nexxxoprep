import type { AppConfig } from '@nexoprep/config'
import { AppError } from '@nexoprep/shared'

export type ElevenLabsAgentAudit = {
  agentId: string
  agentName: string | null
  llm: string | null
  customLlmEnabled: boolean
  customLlmUrl: string | null
  customLlmApiType: string | null
  customLlmExtraBodyOverrideEnabled: boolean
  backupLlmPreference: string | null
  backupLlmOrder: string[]
  dynamicVariablePlaceholders: string[]
}

type AgentApiResponse = {
  name?: string
  conversation_config?: {
    agent?: {
      prompt?: {
        llm?: string
        custom_llm?: {
          url?: string
          api_type?: string
        }
        backup_llm_config?: {
          preference?: string
          order?: string[]
        }
      }
      dynamic_variables?: {
        dynamic_variable_placeholders?: Record<string, unknown>
      }
    }
  }
  platform_settings?: {
    overrides?: {
      custom_llm_extra_body?: boolean
    }
  }
}

export class ElevenLabsService {
  constructor(private readonly config: AppConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.ELEVENLABS_API_KEY && this.config.ELEVENLABS_AGENT_ID)
  }

  private get agentId(): string {
    if (!this.config.ELEVENLABS_AGENT_ID) {
      throw new AppError('ElevenLabs agent id is not configured', { code: 'SERVICE_UNAVAILABLE', statusCode: 503 })
    }
    return this.config.ELEVENLABS_AGENT_ID
  }

  private async agentRequest<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.config.ELEVENLABS_API_KEY) {
      throw new AppError('ElevenLabs is not configured', { code: 'SERVICE_UNAVAILABLE', statusCode: 503 })
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${path}`, {
      ...init,
      headers: {
        'xi-api-key': this.config.ELEVENLABS_API_KEY,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      throw new AppError('ElevenLabs agent API request failed', {
        code: 'UPSTREAM_ERROR',
        statusCode: 502,
        details: { status: response.status, body: text.slice(0, 500) },
      })
    }

    return (await response.json()) as T
  }

  async getConversationToken(participantName?: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new AppError('ElevenLabs is not configured', { code: 'SERVICE_UNAVAILABLE', statusCode: 503 })
    }

    const params = new URLSearchParams({ agent_id: this.agentId })
    if (participantName) params.set('participant_name', participantName)

    const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?${params}`, {
      headers: { 'xi-api-key': this.config.ELEVENLABS_API_KEY! },
    })

    if (!response.ok) {
      const text = await response.text()
      throw new AppError('Failed to obtain ElevenLabs conversation token', {
        code: 'UPSTREAM_ERROR',
        statusCode: 502,
        details: { status: response.status, body: text.slice(0, 500) },
      })
    }

    const body = (await response.json()) as { token: string }
    return body.token
  }

  async getAgentAudit(): Promise<ElevenLabsAgentAudit | null> {
    if (!this.isConfigured()) return null

    const agent = await this.agentRequest<AgentApiResponse>(this.agentId)
    const prompt = agent.conversation_config?.agent?.prompt
    const placeholders = agent.conversation_config?.agent?.dynamic_variables?.dynamic_variable_placeholders || {}

    return {
      agentId: this.agentId,
      agentName: agent.name ?? null,
      llm: prompt?.llm ?? null,
      customLlmEnabled: prompt?.llm === 'custom-llm',
      customLlmUrl: prompt?.custom_llm?.url ?? null,
      customLlmApiType: prompt?.custom_llm?.api_type ?? null,
      customLlmExtraBodyOverrideEnabled: agent.platform_settings?.overrides?.custom_llm_extra_body === true,
      backupLlmPreference: prompt?.backup_llm_config?.preference ?? null,
      backupLlmOrder: prompt?.backup_llm_config?.order ?? [],
      dynamicVariablePlaceholders: Object.keys(placeholders),
    }
  }

  async ensureCustomLlmExtraBodyOverride(): Promise<boolean> {
    const audit = await this.getAgentAudit()
    if (!audit) return false
    if (audit.customLlmExtraBodyOverrideEnabled) return true

    await this.agentRequest<AgentApiResponse>(this.agentId, {
      method: 'PATCH',
      body: JSON.stringify({
        platform_settings: {
          overrides: {
            custom_llm_extra_body: true,
          },
        },
      }),
    })

    return true
  }
}
