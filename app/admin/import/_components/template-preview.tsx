"use client";

import { useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TEMPLATE_SPECS } from "@/lib/import/template-spec";
import type { ImportEntityType } from "@/lib/import/types";

/**
 * In-page preview of the expected xlsx layout for the chosen entity.
 *
 * Renders the banner + header row + one example row as a horizontally
 * scrolling table, then a per-column legend with required/optional flag
 * and description. A "Download template" button under the preview pulls
 * the actual xlsx from the API route.
 *
 * Collapsed by default so it doesn't dominate the page; admins who already
 * know the format can leave it closed.
 */
export function TemplatePreview({ entity }: { entity: ImportEntityType }) {
  const spec = TEMPLATE_SPECS[entity];
  const [open, setOpen] = useState(false);
  const downloadHref = `/api/import/template/${entity}`;

  return (
    <section className="surface mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`tpl-${entity}-body`}
        className="flex w-full items-center justify-between gap-3 border-b border-border-subtle bg-lightgrey px-5 py-3 text-left transition-colors hover:bg-grey/30"
      >
        <span className="flex items-center gap-2">
          <FileSpreadsheet size={16} strokeWidth={1.7} className="text-teal" />
          <span className="text-[13px] font-semibold text-navy">
            Template preview · {entity}
          </span>
          <span className="text-[11px] text-navy/55">
            {spec.columns.length} columns · {spec.columns.filter((c) => c.required).length}{" "}
            required
          </span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.7}
          className={
            "text-navy/55 transition-transform " + (open ? "rotate-180" : "rotate-0")
          }
        />
      </button>

      {open ? (
        <div id={`tpl-${entity}-body`} className="flex flex-col gap-4 px-5 py-5">
          {/* Banner — mirrors the yellow row in the actual xlsx. */}
          <p className="rounded-md border border-warning/30 bg-warning/8 px-3 py-2 text-[12px] italic text-warning">
            {spec.banner}
          </p>

          {/* Sample table — header row + one example row. */}
          <div className="overflow-x-auto rounded-md border border-border-subtle">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-lightgrey">
                  {spec.columns.map((c) => (
                    <th
                      key={c.header}
                      className="border-b border-border-subtle px-3 py-2 text-left font-semibold text-navy"
                    >
                      <span className="flex items-center gap-1.5">
                        {c.header}
                        {c.required ? (
                          <span
                            aria-label="required"
                            title="Required"
                            className="inline-block h-1.5 w-1.5 rounded-full bg-danger"
                          />
                        ) : null}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {spec.columns.map((c) => (
                    <td
                      key={c.header}
                      className="border-b border-border-subtle px-3 py-2 text-navy/65"
                    >
                      {c.example || <span className="text-navy/35">—</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Per-column descriptions. */}
          <div className="grid gap-2 sm:grid-cols-2">
            {spec.columns.map((c) => (
              <div
                key={c.header}
                className="rounded-md border border-border-subtle bg-white px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-navy">{c.header}</span>
                  <span
                    className={
                      "rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.08em] " +
                      (c.required
                        ? "bg-danger/10 text-danger"
                        : "bg-navy-04 text-navy/55")
                    }
                  >
                    {c.required ? "Required" : "Optional"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-navy/65">{c.description}</p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 rounded-md bg-teal-08 px-3 py-2 text-[11px] text-navy/75">
            <Info size={13} strokeWidth={1.7} className="mt-0.5 shrink-0 text-teal" />
            <p>
              The header row can sit anywhere in the first 10 rows of the file — the parser
              scans for it. Empty rows at the end of the sheet are skipped. Caps: 5 MB / 5000
              rows.
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <Button asChild size="sm">
              <a href={downloadHref} download>
                <Download size={13} strokeWidth={1.7} className="mr-1.5" />
                Download .xlsx template
              </a>
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
