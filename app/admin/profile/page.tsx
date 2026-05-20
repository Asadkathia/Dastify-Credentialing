import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileScreen } from "@/components/profile/profile-screen";

export default async function AdminProfilePage() {
  const session = await requireAdmin();

  return (
    <div>
      <PageHeader title="Profile & settings" subtitle="Manage your account details and sign-in." />
      <ProfileScreen
        fullName={session.fullName}
        email={session.email}
        roleLabel="Dastify · Admin"
      />
    </div>
  );
}
