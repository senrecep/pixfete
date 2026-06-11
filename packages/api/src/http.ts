import type { AppError } from "tsentials/errors"
import { ErrorType } from "tsentials/errors"
import type { Result } from "tsentials/result"
import { Result as R } from "tsentials/result"

const STATUS_BY_TYPE: Record<string, number> = {
  [ErrorType.Validation]: 400,
  [ErrorType.Unauthorized]: 401,
  [ErrorType.Forbidden]: 403,
  [ErrorType.NotFound]: 404,
  [ErrorType.Conflict]: 409,
  [ErrorType.Failure]: 422,
  [ErrorType.Unexpected]: 500,
  [ErrorType.Unknown]: 500,
}

export function statusForError(error: AppError): number {
  return STATUS_BY_TYPE[error.type] ?? 500
}

export interface ErrorBody {
  code: string
  message: string
}

export function errorBody(error: AppError): ErrorBody {
  return { code: error.code, message: error.description }
}

/**
 * Resolves a Result into an Elysia response: on success returns the value,
 * on failure sets the HTTP status from the first error and returns
 * `{ code, message }` (the envelope the web client expects).
 */
export function respond<T>(
  result: Result<T>,
  set: { status?: number | string },
): T | ErrorBody {
  if (R.isSuccess(result)) {
    return result.value
  }
  const first = R.firstError(result)
  set.status = statusForError(first)
  return errorBody(first)
}
