export class AppError extends Error {
  readonly code: string
  readonly statusCode: number
  readonly details?: unknown

  constructor(message: string, options: { code: string; statusCode?: number; details?: unknown }) {
    super(message)
    this.name = 'AppError'
    this.code = options.code
    this.statusCode = options.statusCode ?? 500
    this.details = options.details
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, details?: unknown) {
    super(`${resource} was not found`, { code: 'NOT_FOUND', statusCode: 404, details })
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, { code: 'CONFLICT', statusCode: 409, details })
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, { code: 'VALIDATION_ERROR', statusCode: 400, details })
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, { code: 'UNAUTHORIZED', statusCode: 401 })
  }
}
