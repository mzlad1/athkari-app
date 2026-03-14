import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Voice Generate Edge Function
 *
 * POST body: { adhkar_id: number, profile_id: number, text_ar: string }
 *
 * Flow:
 * 1. Fetch voice profile → get elevenlabs_voice_id
 * 2. Read ElevenLabs API key from Edge Function Secret (server-side only)
 * 3. Call ElevenLabs TTS API with eleven_multilingual_v2
 * 4. Upload MP3 to Supabase Storage bucket "voice-files"
 * 5. Upsert row in voice_files table
 * 6. Return { success: true, public_url }
 *
 * SECURITY: The API key is read exclusively from Deno.env (Supabase Secret).
 * It is NEVER stored in app_config or returned to the client.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ── Parse input ──────────────────────────────────────────────────
    const { adhkar_id, profile_id, text_ar } = await req.json();

    // adhkar_id = -1 means "test only" — generate audio but skip DB upsert/audit
    const isTest = adhkar_id === -1;

    if ((!adhkar_id && adhkar_id !== -1) || !profile_id || !text_ar) {
      return json(
        {
          success: false,
          error: "adhkar_id, profile_id, and text_ar are required",
        },
        400,
      );
    }

    // ── 1. Fetch voice profile ────────────────────────────────────────
    const { data: profile, error: profileErr } = await supabase
      .from("voice_profiles")
      .select("id, name_en, source, elevenlabs_voice_id")
      .eq("id", profile_id)
      .single();

    if (profileErr || !profile) {
      return json({ success: false, error: "Voice profile not found" }, 404);
    }

    if (profile.source !== "elevenlabs") {
      return json(
        { success: false, error: "Profile source is not elevenlabs" },
        400,
      );
    }

    if (!profile.elevenlabs_voice_id) {
      return json(
        {
          success: false,
          error: "Profile has no elevenlabs_voice_id configured",
        },
        400,
      );
    }

    // ── 2. Read ElevenLabs API key from Edge Function Secret ─────────
    // NEVER read from app_config — that table is readable by anon users.
    // Set this in: Supabase Dashboard → Edge Functions → Secrets
    const elevenlabsKey = Deno.env.get("ELEVENLABS_API_KEY") ?? "";

    if (!elevenlabsKey) {
      return json(
        { success: false, error: "ElevenLabs API key not configured" },
        400,
      );
    }

    // ── 3. Call ElevenLabs TTS API ────────────────────────────────────
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${profile.elevenlabs_voice_id}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": elevenlabsKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text_ar,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.85,
          },
        }),
      },
    );

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      return json(
        { success: false, error: `ElevenLabs error: ${errText}` },
        502,
      );
    }

    // ── 4. Generate audio buffer ──────────────────────────────────────
    const audioBuffer = await ttsResponse.arrayBuffer();

    // Test mode (adhkar_id = -1): return a temporary object URL without saving
    if (isTest) {
      const base64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
      const dataUrl = `data:audio/mpeg;base64,${base64}`;
      return json({ success: true, public_url: dataUrl });
    }

    // ── 5. Upload MP3 to Supabase Storage ────────────────────────────
    const storagePath = `${profile_id}/${adhkar_id}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from("voice-files")
      .upload(storagePath, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      return json(
        {
          success: false,
          error: `Storage upload failed: ${uploadError.message}`,
        },
        500,
      );
    }

    // ── 6. Get public URL ─────────────────────────────────────────────
    const { data: urlData } = supabase.storage
      .from("voice-files")
      .getPublicUrl(storagePath);

    // Cache-bust: append timestamp so CDN/browser never serves stale audio
    const cacheBuster = `?v=${Date.now()}`;
    const publicUrl = urlData.publicUrl + cacheBuster;

    // ── 7. Upsert voice_files row ─────────────────────────────────────
    // Rough duration estimate: MP3 at 128 kbps = 16 KB/s
    const durationSeconds = parseFloat(
      (audioBuffer.byteLength / 16000).toFixed(2),
    );

    const { error: upsertError } = await supabase.from("voice_files").upsert(
      {
        profile_id,
        adhkar_id,
        storage_path: storagePath,
        public_url: publicUrl,
        // keep audio_url in sync for legacy consumers
        audio_url: publicUrl,
        duration_seconds: durationSeconds,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,adhkar_id" },
    );

    if (upsertError) {
      return json(
        { success: false, error: `DB upsert failed: ${upsertError.message}` },
        500,
      );
    }

    // ── 8. Audit log ──────────────────────────────────────────────────
    await supabase.from("audit_log").insert({
      admin_name: "System (voice-generate)",
      action: "voice_generate",
      entity_type: "adhkar",
      entity_id: String(adhkar_id),
      new_value: {
        profile_id,
        profile_name: profile.name_en,
        storage_path: storagePath,
        public_url: publicUrl,
        char_count: text_ar.length,
      },
    });

    return json({ success: true, public_url: publicUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: message }, 500);
  }
});
