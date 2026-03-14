/**
 * Sound Effects Service
 *
 * Plays short audio clips for gamification events (tap, level up, etc.)
 * All calls are fire-and-forget — failure is always silent.
 * Respects the kid's sounds_enabled preference via setEnabled().
 *
 * ── Setup ─────────────────────────────────────────────────────────────────────
 * 1. Create folder: assets/sounds/
 * 2. Add MP3 files (free sounds: https://mixkit.co/free-sound-effects/)
 *    Recommended files:
 *      tap.mp3               — very short soft click (~0.1s)
 *      dhikr_complete.mp3    — gentle ding / chime (~0.5s)
 *      category_complete.mp3 — fanfare / celebration (~2s) done
 *      level_up.mp3          — epic level-up jingle (~2s) done
 *      badge_unlock.mp3      — achievement ding (~1s)
 *      tab_press.mp3         — ultra-soft click (~0.1s)
 *      notification.mp3      — soft ping (~0.3s) done
 *      challenge_complete.mp3— victory fanfare (~2s)
 *      daily_goal.mp3        — completion chime (~1s)
 * 3. Uncomment the require() lines below for each file you add.
 */

import { Audio } from "expo-av";

export type SoundEvent =
  | "tap"
  | "dhikr_complete"
  | "category_complete"
  | "level_up"
  | "badge_unlock"
  | "tab_press"
  | "notification"
  | "challenge_complete"
  | "daily_goal"
  | "seasonal_wird";

// ─── Uncomment each line once you add the corresponding file ──────────────────
const ASSETS: Partial<Record<SoundEvent, any>> = {
  tap: require("@/assets/sounds/tap.mp3"),
  dhikr_complete: require("@/assets/sounds/dhikr_complete.mp3"),
  category_complete: require("@/assets/sounds/category_complete.mp3"),
  level_up: require("@/assets/sounds/level_up.mp3"),
  
  badge_unlock: require("@/assets/sounds/badge_unlock.mp3"),
  tab_press: require("@/assets/sounds/tab_press.mp3"),
  notification: require("@/assets/sounds/notification.mp3"),
  challenge_complete: require("@/assets/sounds/challenge_complete.mp3"),
  daily_goal: require("@/assets/sounds/daily_goal.mp3"),
  seasonal_wird: require("@/assets/sounds/seasonal_wird.mp3"),
};

// Volume per event (0.0 – 1.0)
const VOLUMES: Partial<Record<SoundEvent, number>> = {
  tap: 0.4,
  tab_press: 0.3,
  dhikr_complete: 0.7,
  category_complete: 1.0,
  level_up: 1.0,
  badge_unlock: 0.9,
  notification: 0.6,
  challenge_complete: 1.0,
  daily_goal: 0.8,
  seasonal_wird: 1.0,
};

class SoundService {
  private _enabled = true;

  /** Call this whenever activeKid.sounds_enabled changes */
  setEnabled(v: boolean) {
    this._enabled = v;
  }

  /** Play a sound event. Silent no-op if disabled or file not configured. */
  async play(event: SoundEvent): Promise<void> {
    if (!this._enabled) return;
    const asset = ASSETS[event];
    if (!asset) return; // file not yet added — skip silently

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(asset, {
        shouldPlay: true,
        volume: VOLUMES[event] ?? 1.0,
      });
      // Auto-unload after playback finishes
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch {
      // Always fail silently — sound is enhancement, not critical
    }
  }
}

export const soundService = new SoundService();
