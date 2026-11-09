import type { Env } from "./types.ts";
import { sendTelegramMessage } from "./telegram.ts";

/**
 * Health check watchdog executed by Cloudflare Cron Trigger (every minute).
 */
export async function runHealthCheck(env: Env): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const nowMs = Date.now();
  const localTime = new Date().toISOString().replace("T", " ").slice(0, 19);

  // 1. Check Event Freshness (has any launch or trade arrived in D1?)
  const latestEvent = await env.DB.prepare(
    "SELECT MAX(received_at) as latest_ts FROM events"
  ).first<{ latest_ts: number | null }>();

  if (latestEvent && latestEvent.latest_ts) {
    const ageMinutes = Math.floor((nowMs - latestEvent.latest_ts) / 60000);
    const alertKey = "alert_event_freshness";

    const lastAlert = await env.DB.prepare(
      "SELECT value, updated_at FROM health_state WHERE key = ?"
    )
      .bind(alertKey)
      .first<{ value: string; updated_at: number }>();

    if (ageMinutes > 15) {
      // Alert if not sent in the last 1 hour
      const shouldSend = !lastAlert || (nowMs - lastAlert.updated_at) >= 3600000;
      if (shouldSend) {
        const msg = `[${localTime}] WARNING: no new events for ${ageMinutes} min (quiet market or webhook paused) (check: event_freshness, age_minutes: ${ageMinutes})`;
        await sendTelegramMessage(token, chatId, msg);
        await env.DB.prepare(
          "INSERT OR REPLACE INTO health_state (key, value, updated_at) VALUES (?, ?, ?)"
        )
          .bind(alertKey, "active", nowMs)
          .run();
      }
    } else if (lastAlert && lastAlert.value === "active") {
      // Cleared!
      const clearMsg = `[${localTime}] cleared: event_freshness (new events arriving, age: ${ageMinutes} min)`;
      await sendTelegramMessage(token, chatId, clearMsg);
      await env.DB.prepare(
        "INSERT OR REPLACE INTO health_state (key, value, updated_at) VALUES (?, ?, ?)"
      )
        .bind(alertKey, "cleared", nowMs)
        .run();
    }
  }
}
