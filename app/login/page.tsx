import Image from "next/image";
import { LoginForm } from "./_components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Brand panel */}
      <aside
        className="relative hidden overflow-hidden bg-navy px-12 py-12 text-white md:flex md:flex-col"
        aria-hidden
      >
        {/* Subtle brand glows */}
        <span
          className="pointer-events-none absolute -right-24 -top-24 h-[520px] w-[520px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(22,193,194,0.18) 0%, rgba(22,193,194,0) 70%)",
          }}
        />
        <span
          className="pointer-events-none absolute -bottom-44 -left-44 h-[480px] w-[480px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(78,206,209,0.14) 0%, rgba(78,206,209,0) 70%)",
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <Image
            src="/dastify-mark.png"
            alt=""
            aria-hidden
            width={40}
            height={40}
            priority
            className="h-10 w-10"
          />
          <span className="text-[18px] font-semibold tracking-[-0.005em]">Dastify</span>
        </div>

        <div className="relative z-10 mt-auto max-w-[460px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
            Credentialing Portal
          </p>
          <h2 className="mt-3 text-[36px] font-semibold leading-[1.1] tracking-[-0.018em]">
            Every payer.{" "}
            <span
              className="bg-gradient-to-r from-teal to-aqua bg-clip-text text-transparent"
            >
              Every state.
            </span>{" "}
            Every cycle.
          </h2>
          <p className="mt-4 text-[15px] leading-[1.55] text-white/70">
            The operational core for Dastify&apos;s payer-enrollment service — multi-tenant,
            multi-state,
            and accountable from intake to effective.
          </p>
        </div>

        <div className="relative z-10 mt-10 flex gap-5 text-[11px] text-white/40">
          <span>© Dastify Solutions</span>
          <a href="#" className="text-white/65 hover:text-white">
            Compliance
          </a>
          <a href="#" className="text-white/65 hover:text-white">
            Support
          </a>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center bg-white px-6 py-12 md:px-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-8">
            <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-navy">
              Sign in to Dastify
            </h1>
            <p className="mt-1.5 text-[14px] text-navy/60">
              Choose your sign-in method. Self sign-up is disabled.
            </p>
          </div>
          <LoginForm next={params.next} initialError={params.error} />
        </div>
      </main>
    </div>
  );
}
