import { PrismaClient } from '@prisma/client'

export type DatabaseClient = PrismaClient

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  if (!databaseUrl) return new PrismaClient()

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
}

export async function closePrismaClient(prisma: PrismaClient): Promise<void> {
  await prisma.$disconnect()
}
