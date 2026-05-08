import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function AdminClientsListPage() {
  const supabase = await createSupabaseServerClient();
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, display_name, legal_name, primary_contact_name, primary_contact_email, is_active, created_at")
    .is("deleted_at", null)
    .order("display_name", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground">All practices Dastify provides credentialing services to.</p>
        </div>
        <Button asChild>
          <Link href="/admin/clients/new">New client</Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load clients: {error.message}
        </div>
      )}

      {clients && clients.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No clients yet.</p>
            <Button asChild variant="link">
              <Link href="/admin/clients/new">Create your first client</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {clients && clients.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Display name</th>
                  <th className="px-4 py-3 font-medium">Legal name</th>
                  <th className="px-4 py-3 font-medium">Primary contact</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/admin/clients/${c.id}`} className="hover:underline">
                        {c.display_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.legal_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.primary_contact_name || "—"}
                      {c.primary_contact_email && (
                        <span className="block text-xs">{c.primary_contact_email}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.is_active ? (
                        <span className="text-xs text-green-700">Active</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/clients/${c.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
