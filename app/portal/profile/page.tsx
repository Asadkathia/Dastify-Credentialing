import { requireOrganization } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileScreen } from "@/components/profile/profile-screen";

export default async function PortalProfilePage() {
  const session = await requireOrganization();
  const roleLabel = session.role === "org_admin" ? "Organization · Admin" : "Organization · Viewer";

  return (
    <div>
      <PageHeader title="Profile & settings" subtitle="Manage your account details and sign-in." />
      <ProfileScreen fullName={session.fullName} email={session.email} roleLabel={roleLabel} />
    </div>
  );
}
