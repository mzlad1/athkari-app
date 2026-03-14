import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Friend Management Edge Function — BRD §6.1
 *
 * Actions:
 * - send_request: Kid sends friend request via ATHK code
 * - approve: Parent approves request → creates bidirectional friendship
 * - reject: Parent rejects request
 * - remove: Parent removes a friend
 * - send_reaction: Kid sends pre-set reaction (BRD §6.1.3)
 *
 * Safety rules (BRD §10.1):
 * - All friend requests require parent approval
 * - No free-form messages — pre-set reactions only
 * - Max 30 friends (paid) / 1 friend (free)
 */
serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { action, kid_id, friend_code, request_id, friend_id, reaction_type } =
    await req.json();

  switch (action) {
    case "send_request": {
      // Find friend by ATHK code
      const { data: friend } = await supabase
        .from("kids")
        .select("id, name, family_id")
        .eq("friend_code", friend_code)
        .single();

      if (!friend) {
        return new Response(
          JSON.stringify({ error: "Friend code not found" }),
          { status: 404 },
        );
      }

      if (friend.id === kid_id) {
        return new Response(JSON.stringify({ error: "Cannot add yourself" }), {
          status: 400,
        });
      }

      // Check max friends limit
      const { data: kid } = await supabase
        .from("kids")
        .select("id, family_id, families(plan_id, plans(features))")
        .eq("id", kid_id)
        .single();

      const { count: currentFriends } = await supabase
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .eq("kid_id", kid_id);

      const features = kid?.families?.plans?.features || [];
      const maxFriends = features.includes("friends") ? 30 : 1;

      if ((currentFriends || 0) >= maxFriends) {
        return new Response(
          JSON.stringify({
            error: "Max friends limit reached",
            max: maxFriends,
          }),
          { status: 400 },
        );
      }

      // Check if already friends or pending
      const { data: existing } = await supabase
        .from("friend_requests")
        .select("id, status")
        .or(
          `and(from_kid_id.eq.${kid_id},to_kid_id.eq.${friend.id}),and(from_kid_id.eq.${friend.id},to_kid_id.eq.${kid_id})`,
        )
        .in("status", ["pending", "approved"]);

      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ error: "Request already exists" }),
          { status: 400 },
        );
      }

      // Create friend request
      const { data: request } = await supabase
        .from("friend_requests")
        .insert({ from_kid_id: kid_id, to_kid_id: friend.id })
        .select()
        .single();

      // Send push notification to friend's parent
      const { data: friendFamily } = await supabase
        .from("families")
        .select("id")
        .eq("id", friend.family_id)
        .single();

      if (friendFamily) {
        // Store notification using actual schema columns (no family_id/type columns)
        await supabase.from("notifications").insert({
          title_en: "New Friend Request",
          title_ar: "طلب صداقة جديد",
          body_en: `Someone wants to add ${friend.name} as a friend`,
          body_ar: `شخص يريد إضافة ${friend.name} كصديق`,
          target_segment: {
            family_id: friendFamily.id,
            request_id: request?.id,
          },
          scheduled_at: new Date().toISOString(),
        });
      }

      return new Response(JSON.stringify({ success: true, request }));
    }

    case "approve": {
      const { data: request } = await supabase
        .from("friend_requests")
        .update({
          status: "approved",
          approved_by_parent: true,
          parent_approved_at: new Date().toISOString(),
        })
        .eq("id", request_id)
        .select()
        .single();

      if (!request) {
        return new Response(JSON.stringify({ error: "Request not found" }), {
          status: 404,
        });
      }

      // Create bidirectional friendship
      await supabase.from("friendships").insert([
        { kid_id: request.from_kid_id, friend_id: request.to_kid_id },
        { kid_id: request.to_kid_id, friend_id: request.from_kid_id },
      ]);

      // Award referral stars to requester (+25 stars per BRD §3.3)
      const { data: requesterKid } = await supabase
        .from("kids")
        .select("stars")
        .eq("id", request.from_kid_id)
        .single();
      await supabase
        .from("kids")
        .update({ stars: (requesterKid?.stars || 0) + 25 })
        .eq("id", request.from_kid_id);

      return new Response(
        JSON.stringify({ success: true, friendship: "created" }),
      );
    }

    case "reject": {
      await supabase
        .from("friend_requests")
        .update({ status: "rejected" })
        .eq("id", request_id);
      return new Response(JSON.stringify({ success: true }));
    }

    case "remove": {
      await supabase
        .from("friendships")
        .delete()
        .or(
          `and(kid_id.eq.${kid_id},friend_id.eq.${friend_id}),and(kid_id.eq.${friend_id},friend_id.eq.${kid_id})`,
        );
      return new Response(JSON.stringify({ success: true }));
    }

    case "send_reaction": {
      // BRD §6.1.3: Pre-set reactions only
      const VALID_REACTIONS = [
        "well_done",
        "keep_going",
        "masha_allah",
        "challenge_me",
      ];
      if (!VALID_REACTIONS.includes(reaction_type)) {
        return new Response(
          JSON.stringify({ error: "Invalid reaction type" }),
          { status: 400 },
        );
      }

      // Verify they are friends
      const { data: friendship } = await supabase
        .from("friendships")
        .select("id")
        .eq("kid_id", kid_id)
        .eq("friend_id", friend_id)
        .single();

      if (!friendship) {
        return new Response(JSON.stringify({ error: "Not friends" }), {
          status: 403,
        });
      }

      await supabase.from("reactions").insert({
        from_kid_id: kid_id,
        to_kid_id: friend_id,
        type: reaction_type,
      });

      return new Response(JSON.stringify({ success: true }));
    }

    default:
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
      });
  }
});
