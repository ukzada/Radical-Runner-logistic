'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

interface UseNotificationAlarmOptions {
  /** Only poll/alarm when the signed-in user should receive alarms */
  enabled: boolean;
  /** Receives the live unread count (for the bell badge) */
  onUnreadCount?: (count: number) => void;
}

const POLL_INTERVAL_MS = 30_000;

function beep(times = 3): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.45;
      osc.type = 'sine';
      osc.frequency.value = 880; // alarm-like tone
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.35);
    }
  } catch {
    // Audio not available — silent fallback
  }
}

/**
 * Delivery-date alarm hook.
 *
 * - Polls GET /api/notifications every 30s and on window focus
 * - First fetch only PRIMES the baseline (no alarm spam on page load)
 * - Every NEW unread notification afterwards triggers:
 *     1. a sonner warning toast (10s)
 *     2. a 3-beep Web Audio alarm
 *     3. a browser notification (permission requested at login)
 * - Feeds the live unread count to the bell badge via onUnreadCount
 */
export function useNotificationAlarm({ enabled, onUnreadCount }: UseNotificationAlarmOptions): void {
  const primedRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    const poll = async () => {
      try {
        const data = await api.get<NotificationsResponse>('/api/notifications?limit=50');
        const unreadCount = data?.unreadCount ?? 0;
        onUnreadCount?.(unreadCount);

        const unread = (data?.notifications || []).filter((n) => !n.isRead);

        // First successful fetch only establishes the baseline
        if (!primedRef.current) {
          seenIdsRef.current = new Set(unread.map((n) => n.id));
          primedRef.current = true;
          return;
        }

        // Alarm for every unread notification we have not seen yet
        for (const n of unread) {
          if (seenIdsRef.current.has(n.id)) continue;
          seenIdsRef.current.add(n.id);

          toast.warning(n.title || 'New notification', {
            description: n.message?.length > 160 ? `${n.message.slice(0, 160)}…` : n.message,
            duration: 10_000,
          });

          beep(3);

          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(n.title || 'New notification', { body: n.message || '' });
            } catch {
              // Some browsers require a service worker — ignore
            }
          }
        }
      } catch {
        // Network/auth hiccup — retry on next tick
      }
    };

    void poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    const onFocus = () => void poll();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, onUnreadCount]);
}
