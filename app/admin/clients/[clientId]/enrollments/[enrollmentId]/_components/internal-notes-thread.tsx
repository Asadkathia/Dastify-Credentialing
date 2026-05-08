"use client";
import { useState, useTransition } from "react";
import { format } from "date-fns";
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
    <div className="space-y-4">
      <p className="text-xs text-amber-800">
        Internal notes are visible to Dastify staff only — never shown to the client.
      </p>
      {notes.length === 0 && <p className="text-sm text-muted-foreground">No internal notes yet.</p>}
      {notes.length > 0 && (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="mt-2 text-xs text-amber-700">
                {format(new Date(n.created_at), "PP p")}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form
        className="space-y-2"
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
          placeholder="Internal-only note (admins only)..."
          rows={3}
          required
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" size="sm" variant="outline" disabled={pending || !body.trim()}>
          {pending ? "Posting..." : "Post internal note"}
        </Button>
      </form>
    </div>
  );
}
