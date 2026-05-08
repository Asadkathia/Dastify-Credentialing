import { LoginForm } from "./_components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Dastify Credentialing</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to access the credentialing portal.
          </p>
        </div>
        <LoginForm next={params.next} initialError={params.error} />
      </div>
    </div>
  );
}
