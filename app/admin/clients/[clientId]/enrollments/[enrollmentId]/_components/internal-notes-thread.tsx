"use client";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { postInternalNoteAction } from "@/lib/actions/comments";

type NoteRow = {
  id: string;
  body: string;
  author_user_id: string;
  parent_note_id: string | null;
  created_at: string;
};

export function InternalNotesThread({
  enrollmentId,
  notes,
}: {
  enrollmentId: string;
  notes: NoteRow[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-5">
      {notes.length === 0 ? (
        <div className="flex items-start gap-3 rounded-md border border-warning/20 bg-white px-4 py-3 text-[13px] text-navy/65">
          <Lock size={14} strokeWidth={1.6} className="mt-0.5 shrink-0 text-[#7a4f00]" />
          <p>
            No internal notes yet. Notes posted here are visible to Dastify staff only — they are
            never returned to client sessions.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-md border border-warning/30 bg-white px-4 py-3 shadow-[var(--shadow-xs)]"
            >
              <p className="whitespace-pre-wrap text-[13px] leading-[22px] text-charcoal">
                {n.body}
              </p>
              <p className="mt-2 tnum text-[11px] text-[#7a4f00]">
                {format(new Date(n.created_at), "PP · p")}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form
        className="space-y-3 border-t border-warning/20 pt-4"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await postInternalNoteAction(formData);
            if (!result.ok) {
              setError(result.error);
            } else {
              setBody("");
            }
          });
        }}
      >
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
        <Textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Internal-only note (admins only)…"
          rows={3}
          required
          className="bg-white text-[13px]"
        />
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-danger/20 bg-danger-08 px-3 py-2 text-[12px] text-danger"
          >
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={pending || !body.trim()}
          >
            {pending ? "Posting…" : "Post internal note"}
          </Button>
        </div>
      </form>
    </div>
  );
}
