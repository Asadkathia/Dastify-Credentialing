import Image from "next/image";
import { Lock, ShieldCheck, Award } from "lucide-react";
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
      >
        {/* Dot-grid background */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(22,193,194,0.07) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Subtle brand glows */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 z-0 h-[520px] w-[520px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(22,193,194,0.18) 0%, rgba(22,193,194,0) 70%)",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-44 -left-44 z-0 h-[480px] w-[480px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(78,206,209,0.14) 0%, rgba(78,206,209,0) 70%)",
          }}
        />

        {/* ECG line — drawn on load, sits behind content near the bottom */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-[28%] z-0 h-[80px]"
        >
          <svg
            viewBox="0 0 1000 80"
            preserveAspectRatio="none"
            className="h-full w-full"
          >
            <path
              className="ecg-path"
              d="M0,40 L80,40 L110,40 L120,12 L130,68 L140,40 L160,40 L240,40 L270,40 L280,12 L290,68 L300,40 L320,40 L400,40 L430,40 L440,12 L450,68 L460,40 L480,40 L560,40 L590,40 L600,12 L610,68 L620,40 L640,40 L720,40 L750,40 L760,12 L770,68 L780,40 L800,40 L1000,40"
              stroke="#16C1C2"
              strokeWidth={1.2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.4}
            />
          </svg>
        </span>

        <div className="relative z-10 flex items-center">
          <Image
            src="/dastify-logo-on-dark.svg"
            alt="Dastify"
            width={172}
            height={80}
            priority
            className="h-10 w-auto"
          />
        </div>

        <div className="relative z-10 mt-auto max-w-[460px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
            Credentialing Portal
          </p>
          <h2 className="mt-3 text-[36px] font-semibold leading-[1.1] tracking-[-0.018em]">
            Every payer.{" "}
            <span className="bg-gradient-to-r from-teal to-aqua bg-clip-text text-transparent">
              Every state.
            </span>{" "}
            Every cycle.
          </h2>
          <p className="mt-4 text-[15px] leading-[1.55] text-white/70">
            The operational core for Dastify&apos;s payer-enrollment service — multi-tenant,
            multi-state,
            and accountable from intake to effective.
          </p>

          {/* Stats strip */}
          <dl className="mt-8 hidden md:flex">
            <div className="flex-1 border-r border-white/10 pr-6">
              <dt className="sr-only">First-Pass Rate</dt>
              <dd className="text-[22px] font-bold leading-none text-teal tnum">97.4%</dd>
              <p
                aria-hidden
                className="mt-1.5 text-[10px] font-normal uppercase tracking-[0.15em] text-white/35"
              >
                First-Pass Rate
              </p>
            </div>
            <div className="flex-1 border-r border-white/10 px-6">
              <dt className="sr-only">Payers Covered</dt>
              <dd className="text-[22px] font-bold leading-none text-teal tnum">500+</dd>
              <p
                aria-hidden
                className="mt-1.5 text-[10px] font-normal uppercase tracking-[0.15em] text-white/35"
              >
                Payers Covered
              </p>
            </div>
            <div className="flex-1 pl-6">
              <dt className="sr-only">States Active</dt>
              <dd className="text-[22px] font-bold leading-none text-teal tnum">50</dd>
              <p
                aria-hidden
                className="mt-1.5 text-[10px] font-normal uppercase tracking-[0.15em] text-white/35"
              >
                States Active
              </p>
            </div>
          </dl>
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

          {/* Trust badges */}
          <div className="mt-6 flex items-center justify-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy/45">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={11} strokeWidth={1.8} aria-hidden />
              HIPAA
            </span>
            <span aria-hidden className="size-[3px] rounded-full bg-navy/20" />
            <span className="inline-flex items-center gap-1.5">
              <Award size={11} strokeWidth={1.8} aria-hidden />
              SOC 2 Type II
            </span>
            <span aria-hidden className="size-[3px] rounded-full bg-navy/20" />
            <span className="inline-flex items-center gap-1.5">
              <Lock size={11} strokeWidth={1.8} aria-hidden />
              256-bit SSL
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
