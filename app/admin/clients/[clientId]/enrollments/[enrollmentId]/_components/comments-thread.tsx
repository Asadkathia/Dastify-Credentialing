"use client";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { postCommentAction } from "@/lib/actions/comments";

type CommentRow = {
  id: string;
  body: string;
  author_user_id: string;
  parent_comment_id: string | null;
  created_at: string;
};

export function CommentsThread({
  enrollmentId,
  comments,
  allowPost,
}: {
  enrollmentId: string;
  comments: CommentRow[];
  allowPost: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-5">
      {comments.length === 0 ? (
        <div className="flex items-start gap-3 rounded-md bg-lightgrey px-4 py-3 text-[13px] text-navy/55">
          <MessageSquare size={16} strokeWidth={1.6} className="mt-0.5 shrink-0 text-teal" />
          <p>No comments yet. Start the conversation with the client below.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-border-subtle bg-white px-4 py-3 shadow-[var(--shadow-xs)]"
            >
              <p className="whitespace-pre-wrap text-[13px] leading-[22px] text-charcoal">
                {c.body}
              </p>
              <p className="mt-2 tnum text-[11px] text-navy/55">
                {format(new Date(c.created_at), "PP · p")}
              </p>
            </li>
          ))}
        </ul>
      )}

      {allowPost ? (
        <form
          className="space-y-3 border-t border-border-subtle pt-4"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await postCommentAction(formData);
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
            placeholder="Write a comment visible to the client…"
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
            <Button type="submit" size="sm" disabled={pending || !body.trim()}>
              {pending ? "Posting…" : "Post comment"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
