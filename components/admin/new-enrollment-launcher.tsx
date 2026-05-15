import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrganizationKind } from "@/db/schema/organizations";
import {
  NewEnrollmentDialog,
  type NewEnrollmentDialogProps,
  type OrgOption,
  type ClientOption,
  type PayerOption,
} from "./new-enrollment-dialog";

type ServerProps = Omit<
  NewEnrollmentDialogProps,
  "organizations" | "clients" | "payers"
>;

/**
 * Server wrapper for {@link NewEnrollmentDialog}. Fetches the option lists
 * (organizations, clients, payers) under admin RLS and hands them to the
 * client dialog.
 *
 * Counts are small enough today (small B2B, ~25 payers, ≤10 clients per org)
 * that loading everything once at parent render is cheaper than running an
 * extra round-trip on every org-change in the modal.
 */
export async function NewEnrollmentLauncher(props: ServerProps) {
  const supabase = await createSupabaseServerClient();

  const [orgsRes, clientsRes, payersRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, display_name, kind")
      .is("deleted_at", null)
      .order("display_name"),
    supabase
      .from("clients")
      .select("id, organization_id, first_name, middle_name, last_name, suffix")
      .is("deleted_at", null)
      .order("last_name"),
    supabase
      .from("payers")
      .select("id, name, states_active")
      .order("name"),
  ]);

  const organizations: OrgOption[] = (orgsRes.data ?? []).map((o) => ({
    id: o.id,
    displayName: o.display_name,
    kind: o.kind as OrganizationKind,
  }));
  const clients: ClientOption[] = (clientsRes.data ?? []).map((c) => ({
    id: c.id,
    organizationId: c.organization_id,
    firstName: c.first_name,
    lastName: c.last_name,
    middleName: c.middle_name,
    suffix: c.suffix,
  }));
  const payers: PayerOption[] = (payersRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    statesActive: (p.states_active ?? []) as string[],
  }));

  return (
    <NewEnrollmentDialog
      organizations={organizations}
      clients={clients}
      payers={payers}
      {...props}
    />
  );
}
