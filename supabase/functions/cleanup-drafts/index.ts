// cleanup-drafts Edge Function
// Deletes stale drafts older than 10 minutes from active_drafts table
// Schedule: Every minute (*/1 * * * *)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate cutoff time (10 minutes ago from creation)
    // Hard deadline: Draft must be completed within 10 minutes of creation
    const cutoffTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Delete stale drafts based on created_at (absolute lifetime)
    const { data, error, count } = await supabase
      .from("active_drafts")
      .delete()
      .lt("created_at", cutoffTime)
      .select("id, user_id");

    if (error) {
      console.error("Error deleting stale drafts:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const deletedCount = data?.length || 0;
    console.log(`Cleanup completed: ${deletedCount} stale drafts deleted`);

    // Log deleted drafts for debugging
    if (data && data.length > 0) {
      console.log("Deleted draft IDs:", data.map(d => d.id));
    }

    return new Response(
      JSON.stringify({
        success: true,
        deleted_count: deletedCount,
        cutoff_time: cutoffTime,
        deleted_drafts: data || [],
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (err) {
    console.error("Cleanup function error:", err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err instanceof Error ? err.message : "Unknown error" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
