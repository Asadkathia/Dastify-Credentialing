import Link from "next/link";
import { Lock, ShieldCheck, Award } from "lucide-react";
import { ForgotPasswordForm } from "./_components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-navy px-12 py-12 text-white md:flex md:flex-col">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(22,193,194,0.07) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
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

        <div className="relative z-10 flex flex-col items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/dastify-logo.svg"
            alt="Dastify"
            className="h-[112px] w-auto select-none drop-shadow-[0_8px_28px_rgba(22,193,194,0.18)]"
            draggable={false}
          />
          <span className="flex flex-col leading-tight">
            <span className="text-[16px] font-bold uppercase tracking-[0.08em] text-white">
              Dastify
            </span>
            <span className="text-[10px] font-normal uppercase tracking-[0.36em] text-white/40">
              Solutions
            </span>
          </span>
        </div>

        <div className="relative z-10 mt-auto w-full text-center">
          <h1
            className="whitespace-nowrap font-semibold leading-[1.1] tracking-[-0.018em] text-teal"
            style={{ fontSize: "clamp(38px, 4.4vw, 68px)" }}
          >
            Account Recovery
          </h1>
          <span aria-hidden className="mx-auto mt-7 block h-[2px] w-16 bg-teal" />
          <p className="mx-auto mt-6 max-w-[640px] text-center text-[18px] leading-[1.55] text-white/70">
            Enter the email you use to sign in and we&apos;ll send you a secure link
            to reset your password.
          </p>
        </div>
      </aside>

      <main className="flex items-center justify-center bg-white px-6 py-12 md:px-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-8">
            <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-navy">
              Reset your password
            </h1>
            <p className="mt-1.5 text-[14px] text-navy/60">
              We&apos;ll email you a link to set a new password.
            </p>
          </div>

          <ForgotPasswordForm />

          <p className="mt-6 text-center text-[12px] text-navy/55">
            Remembered it?{" "}
            <Link
              href="/login"
              className="font-semibold text-teal hover:text-[#0E7475]"
            >
              Back to sign in
            </Link>
          </p>

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
