import type { FastifyInstance } from 'fastify'
import { createId } from '@nexoprep/shared'
import { toPrismaJson } from '@nexoprep/database'
import type { RealtimeEvent } from '@nexoprep/types'
import type { RawData, WebSocket } from 'ws'

export async function registerRealtimeGateway(server: FastifyInstance): Promise<void> {
  const clients = new Map<string, { userId: string; socket: WebSocket }>()

  const unsubscribe = await server.container.eventBus.subscribe(async (event) => {
    const payload = event.payload as { userId?: string }
    for (const [connectionId, client] of clients.entries()) {
      if (payload.userId && client.userId !== payload.userId) continue
      try {
        client.socket.send(JSON.stringify(event))
      } catch (error) {
        server.log.warn({ error, connectionId }, 'failed to push realtime event')
        clients.delete(connectionId)
      }
    }
  })

  server.addHook('onClose', async () => {
    await unsubscribe()
  })

  server.get('/ws/realtime', { websocket: true }, async (socket, request) => {
    const url = new URL(request.url, 'http://localhost')
    const userId = url.searchParams.get('userId')
    if (!userId) {
      socket.close(1008, 'userId query parameter is required')
      return
    }

    const connectionId = createId('conn')
    clients.set(connectionId, { userId, socket: socket as unknown as WebSocket })

    const event = server.container.eventBus.create('USER_CONNECTED', {
      userId,
      connectionId,
      connectedAt: new Date().toISOString(),
    })
    await server.container.prisma.eventLog.create({
      data: {
        type: event.type,
        userId,
        payload: toPrismaJson(event.payload),
      },
    })
    await server.container.eventBus.publish(event)

    socket.on('message', async (raw: RawData) => {
      const message = JSON.parse(raw.toString()) as Partial<RealtimeEvent>
      server.log.debug({ connectionId, type: message.type }, 'received websocket message')
    })

    socket.on('close', () => {
      clients.delete(connectionId)
    })
  })
}
