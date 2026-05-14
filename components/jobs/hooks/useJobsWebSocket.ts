'use client'

/**
 * useJobsWebSocket — subscribes to the `CleanFlowAI-WS` `/jobs` channel and
 * dispatches incremental Job/JobRun deltas into the Redux `jobs` slice.
 *
 * Critical:
 *   - Uses the Cognito ACCESS token (`session.getAccessToken()`), NOT the
 *     id token — per CLAUDE.md and FE bugfix `d9862df`. Sending the id token
 *     causes a silent 401 on `$connect`.
 *   - Falls back to `pollJobRun` from `lib/api/jobs-api` when the socket
 *     drops. Poll interval defaults to 12 s (spec §B5); only polls the
 *     active job + currently-running jobs from the list.
 *   - All status copy is muted ("disconnected — reconnecting…") — spec
 *     forbids toasts for transient transport state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { loadTokens } from '@/lib/auth-session'
import {
  fetchJobs,
  fetchJobRuns,
  runProgressUpdate,
} from '@/lib/features/jobsSlice'
import { useAppDispatch, useAppSelector } from '@/lib/store'
import type { JobRun } from '@/lib/types/jobs'

import type { JobsWsMessage } from '../_placeholder-types'

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * `NEXT_PUBLIC_WS_URL` — set per AWS instance (see CLAUDE.md remediation
 * section). If unset the hook becomes a no-op WS-wise and only polls.
 */
const WS_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WS_URL) || ''

/** Poll cadence when WS is unavailable / disconnected. Spec floor: 5 s. */
const FALLBACK_POLL_MS = 12_000

/** Max backoff between reconnect attempts. */
const MAX_RECONNECT_DELAY_MS = 30_000

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseJobsWebSocketResult {
  /** `true` when the socket is OPEN. */
  connected: boolean
  /** `true` when we're polling because the socket isn't available. */
  fallbackPolling: boolean
  /** Last transport error, for the muted toolbar chip. */
  errorMessage: string | null
  /** Force a reconnect (e.g. user clicks the disconnected chip). */
  reconnect: () => void
}

export function useJobsWebSocket(orgId?: string | null): UseJobsWebSocketResult {
  const dispatch = useAppDispatch()
  const list = useAppSelector((s) => s.jobs.list)
  const activeJobId = useAppSelector((s) => s.jobs.activeJobId)

  const [connected, setConnected] = useState(false)
  const [fallbackPolling, setFallbackPolling] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const closedByUserRef = useRef(false)

  // Track the latest list / activeJobId without re-creating the WS callbacks
  const listRef = useRef(list)
  const activeJobIdRef = useRef(activeJobId)
  useEffect(() => { listRef.current = list }, [list])
  useEffect(() => { activeJobIdRef.current = activeJobId }, [activeJobId])

  // ── Fallback polling ──────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return
    setFallbackPolling(true)
    const tick = () => {
      const tokens = loadTokens()
      if (!tokens?.accessToken) return
      // Only refresh the visible list + active job runs; spec §7 q4
      // ("poll-only-running" recommendation).
      dispatch(fetchJobs({ accessToken: tokens.accessToken })).catch(() => {})
      const aid = activeJobIdRef.current
      if (aid) {
        dispatch(fetchJobRuns({ jobId: aid, accessToken: tokens.accessToken })).catch(() => {})
      }
    }
    // Fire immediately so the user doesn't wait a full interval on disconnect.
    tick()
    pollTimerRef.current = setInterval(tick, FALLBACK_POLL_MS)
  }, [dispatch])

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setFallbackPolling(false)
  }, [])

  // ── Message handling ──────────────────────────────────────────────────────

  const handleMessage = useCallback(
    (raw: string) => {
      let msg: JobsWsMessage
      try {
        msg = JSON.parse(raw) as JobsWsMessage
      } catch {
        return
      }
      if (msg.type === 'run_update' && msg.job_id && msg.run_id) {
        // The BE sends a partial; merge into a JobRun-shape and dispatch.
        const partial: JobRun = {
          job_id: msg.job_id,
          run_id: msg.run_id,
          status: (msg.status ?? (msg.delta?.status as string)) ?? 'RUNNING',
          ...(msg.delta ?? {}),
        } as JobRun
        dispatch(runProgressUpdate({ jobId: msg.job_id, run: partial }))
      } else if (msg.type === 'job_update' && msg.job_id) {
        // Cheap path: re-fetch the list so all derived fields stay consistent.
        const tokens = loadTokens()
        if (tokens?.accessToken) {
          dispatch(fetchJobs({ accessToken: tokens.accessToken })).catch(() => {})
        }
      }
    },
    [dispatch]
  )

  // ── Connection lifecycle ──────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (!WS_URL) {
      // No WS configured — start polling as the sole transport.
      startPolling()
      return
    }
    const tokens = loadTokens()
    if (!tokens?.accessToken) {
      // No auth yet — defer; AuthProvider will re-render us once tokens land.
      return
    }
    closedByUserRef.current = false

    // Per CLAUDE.md: the `$connect` route validates via cognito-idp:GetUser
    // using the ACCESS token. The token is appended as a query string because
    // browser WebSocket APIs cannot set custom request headers.
    const url = `${WS_URL}?token=${encodeURIComponent(tokens.accessToken)}${
      orgId ? `&org_id=${encodeURIComponent(orgId)}` : ''
    }`

    try {
      const ws = new WebSocket(url)
      socketRef.current = ws

      ws.addEventListener('open', () => {
        reconnectAttemptsRef.current = 0
        setConnected(true)
        setErrorMessage(null)
        stopPolling()
        // Subscribe to org-wide jobs channel; protocol mirrors the
        // collab-editing $jobs route on `CleanFlowAI-WS`.
        try {
          ws.send(
            JSON.stringify({ action: 'subscribe', topic: 'jobs', org_id: orgId ?? null })
          )
        } catch {
          /* socket may already be closing */
        }
      })

      ws.addEventListener('message', (event) => {
        if (typeof event.data === 'string') handleMessage(event.data)
      })

      ws.addEventListener('error', () => {
        setErrorMessage('disconnected — reconnecting…')
      })

      ws.addEventListener('close', () => {
        setConnected(false)
        socketRef.current = null
        if (!closedByUserRef.current) {
          startPolling()
          scheduleReconnect()
        }
      })
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'WS connect failed')
      startPolling()
      scheduleReconnect()
    }
  }, [handleMessage, orgId, startPolling, stopPolling])

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return
    const attempt = reconnectAttemptsRef.current
    // Exponential backoff: 1s, 2s, 4s, ..., capped.
    const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS)
    reconnectAttemptsRef.current = attempt + 1
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null
      connect()
    }, delay)
  }, [connect])

  const reconnect = useCallback(() => {
    if (socketRef.current) {
      try {
        closedByUserRef.current = true
        socketRef.current.close()
      } catch {
        /* noop */
      }
    }
    reconnectAttemptsRef.current = 0
    connect()
  }, [connect])

  // ── Mount / unmount ───────────────────────────────────────────────────────

  useEffect(() => {
    connect()
    return () => {
      closedByUserRef.current = true
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (socketRef.current) {
        try { socketRef.current.close() } catch { /* noop */ }
        socketRef.current = null
      }
      stopPolling()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  return useMemo(
    () => ({ connected, fallbackPolling, errorMessage, reconnect }),
    [connected, fallbackPolling, errorMessage, reconnect]
  )
}
