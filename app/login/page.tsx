import { Lock, ShieldCheck, Award } from "lucide-react";
import { LoginForm } from "./_components/login-form";
import { safeNextPath } from "@/lib/auth/safe-next";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params.next ? safeNextPath(params.next, "") : "";
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Brand panel */}
      <aside
        className="relative hidden overflow-hidden bg-navy px-12 py-12 text-white md:flex md:flex-col"
      >
        {/* Dot-grid */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(22,193,194,0.07) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Radial brand glows — both teal, per design */}
        <span
          aria-hidden
          className="pointer-events-none absolute z-0 rounded-full"
          style={{
            top: "-10%",
            right: "-10%",
            width: "70%",
            height: "70%",
            background:
              "radial-gradient(circle, rgba(22,193,194,0.12) 0%, rgba(22,193,194,0) 70%)",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute z-0 rounded-full"
          style={{
            bottom: "-5%",
            left: "5%",
            width: "50%",
            height: "50%",
            background:
              "radial-gradient(circle, rgba(22,193,194,0.07) 0%, rgba(22,193,194,0) 70%)",
          }}
        />

        {/* Floating medical shapes — soft ambience behind copy */}
        <FloatingShapes />

        {/* ECG line — drawn on load */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-[28%] z-0 h-[80px]"
          style={{ opacity: 0.08 }}
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
            />
          </svg>
        </span>

        <div className="relative z-10 mt-auto w-full text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/login-hero.svg"
            alt=""
            aria-hidden
            className="mx-auto mb-10 block h-auto w-full max-w-[912px] select-none"
            draggable={false}
          />
          <div className="mx-auto text-center">
            <h1
              className="whitespace-nowrap font-semibold leading-[1.1] tracking-[-0.018em] text-teal"
              style={{ fontSize: "clamp(38px, 4.4vw, 68px)" }}
            >
              Credentialing Portal
            </h1>
          </div>
          <span aria-hidden className="mx-auto mt-7 block h-[2px] w-16 bg-teal" />
          <p className="mx-auto mt-6 max-w-[640px] text-center text-[18px] leading-[1.55] text-white/70">
            The operational core for Dastify&apos;s payer-enrollment service — multi-tenant,
            multi-state, and accountable from intake to effective.
          </p>

          {/* Stats strip */}
          <dl className="mt-8 hidden border-t border-white/8 pt-8 md:flex">
            <div className="flex-1 border-r border-white/10 pr-6 text-center">
              <dt className="sr-only">First-Pass Rate</dt>
              <dd className="text-[30px] font-bold leading-none text-teal tnum">98.5%</dd>
              <p
                aria-hidden
                className="mt-2 text-[12px] font-normal uppercase tracking-[0.15em] text-white/35"
              >
                First-Pass Rate
              </p>
            </div>
            <div className="flex-1 border-r border-white/10 px-6 text-center">
              <dt className="sr-only">Payers Covered</dt>
              <dd className="text-[30px] font-bold leading-none text-teal tnum">500+</dd>
              <p
                aria-hidden
                className="mt-2 text-[12px] font-normal uppercase tracking-[0.15em] text-white/35"
              >
                Payers Covered
              </p>
            </div>
            <div className="flex-1 pl-6 text-center">
              <dt className="sr-only">States Active</dt>
              <dd className="text-[30px] font-bold leading-none text-teal tnum">50</dd>
              <p
                aria-hidden
                className="mt-2 text-[12px] font-normal uppercase tracking-[0.15em] text-white/35"
              >
                States Active
              </p>
            </div>
          </dl>
        </div>

        <div className="relative z-10 mt-10 flex justify-center gap-5 text-[11px] text-white/40">
          <span>© Dastify Solutions</span>
          <a href="#" className="text-white/65 hover:text-white">
            Compliance
          </a>
          <a href="#" className="text-white/65 hover:text-white">
            Support
          </a>
          <a href="#" className="text-white/65 hover:text-white">
            Privacy
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
          <LoginForm next={nextPath || undefined} initialError={params.error} />

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

function FloatingShapes() {
  return (
    <>
      {/* Rounded plus (top-left) */}
      <svg
        aria-hidden
        className="pointer-events-none absolute z-0 floatA"
        style={{ top: "12%", left: "8%", opacity: 0.05 }}
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
      >
        <rect
          x="48"
          y="12"
          width="24"
          height="96"
          rx="8"
          fill="white"
        />
        <rect
          x="12"
          y="48"
          width="96"
          height="24"
          rx="8"
          fill="white"
        />
      </svg>
      {/* Shield with check (mid-right) */}
      <svg
        aria-hidden
        className="pointer-events-none absolute z-0 floatB"
        style={{ top: "32%", right: "10%", opacity: 0.045 }}
        width="140"
        height="140"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="1.2"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      {/* Dotted bullseye (bottom-left) */}
      <svg
        aria-hidden
        className="pointer-events-none absolute z-0 floatA"
        style={{ bottom: "16%", left: "12%", opacity: 0.05 }}
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        stroke="white"
        strokeWidth="1.2"
      >
        <circle cx="60" cy="60" r="56" strokeDasharray="3 4" />
        <circle cx="60" cy="60" r="34" />
        <circle cx="60" cy="60" r="12" fill="white" />
      </svg>
      {/* Dashed square (bottom-right) */}
      <svg
        aria-hidden
        className="pointer-events-none absolute z-0 floatB"
        style={{ bottom: "10%", right: "14%", opacity: 0.04 }}
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
        stroke="white"
        strokeWidth="1.4"
      >
        <rect x="8" y="8" width="64" height="64" rx="10" strokeDasharray="5 5" />
      </svg>
    </>
  );
}
