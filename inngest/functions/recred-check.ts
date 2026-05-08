import { inngest } from "../client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Daily cron: for every effective enrollment whose next_recred_due_date is
 * less than 90 days away AND has no child enrollment yet, create a new
 * cycle-N+1 enrollment in 'intake' status. Linked via parent_enrollment_id.
 *
 * Runs at 03:00 UTC daily.
 */
export const recredCheck = inngest.createFunction(
  { id: "recred-check", name: "Daily recred-creation check" },
  { cron: "0 3 * * *" },
  async ({ step }) => {
    const supabase = createSupabaseAdminClient();

    const cutoff = await step.run("compute-cutoff", () => {
      const d = new Date();
      d.setDate(d.getDate() + 90);
      return d.toISOString().slice(0, 10);
    });

    const due = await step.run("query-effective-enrollments-due", async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, client_id, provider_id, group_entity_id, payer_id, state, cycle_number")
        .eq("status", "effective")
        .not("next_recred_due_date", "is", null)
        .lte("next_recred_due_date", cutoff)
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    });

    let created = 0;
    for (const e of due) {
      const exists = await step.run(`check-child-${e.id}`, async () => {
        const { data } = await supabase
          .from("enrollments")
          .select("id")
          .eq("parent_enrollment_id", e.id)
          .maybeSingle();
        return Boolean(data);
      });
      if (exists) continue;

      await step.run(`create-cycle-${e.id}`, async () => {
        const { error } = await supabase.from("enrollments").insert({
          client_id: e.client_id,
          provider_id: e.provider_id,
          group_entity_id: e.group_entity_id,
          payer_id: e.payer_id,
          state: e.state,
          cycle_number: e.cycle_number + 1,
          parent_enrollment_id: e.id,
          status: "intake",
        });
        if (error) throw error;
        created++;
      });
    }

    return { processed: due.length, created };
  },
);
