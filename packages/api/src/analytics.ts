import type { AnalyticsEvent } from "@pixfete/shared"
import { db } from "./db"
import { analyticsEvents } from "./db/schema"
import { logger } from "./logger"

export interface TrackParams {
  eventType: AnalyticsEvent
  sessionId?: string | null
  ipAddress: string
  userAgent: string
  metadata?: Record<string, unknown>
}

/**
 * Records an analytics event. Failures are logged but never propagated —
 * analytics must never break a user-facing request.
 */
export function track(params: TrackParams): void {
  try {
    db.insert(analyticsEvents)
      .values({
        id: crypto.randomUUID(),
        eventType: params.eventType,
        sessionId: params.sessionId ?? null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: JSON.stringify(params.metadata ?? {}),
        createdAt: Date.now(),
      })
      .run()
  } catch (err) {
    logger.warn({ err, eventType: params.eventType }, "failed to record analytics event")
  }
}
