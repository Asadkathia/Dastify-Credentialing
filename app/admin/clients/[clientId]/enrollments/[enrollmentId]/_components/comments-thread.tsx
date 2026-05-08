"use client";
import { useState, useTransition } from "react";
import { format } from "date-fns";
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
    <div className="space-y-4">
      {comments.length === 0 && (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}
      {comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-md border bg-background p-3 text-sm">
              <p className="whitespace-pre-wrap">{c.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {format(new Date(c.created_at), "PP p")}
              </p>
            </li>
          ))}
        </ul>
      )}

      {allowPost && (
        <form
          className="space-y-2"
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
            placeholder="Write a comment visible to the client..."
            rows={3}
            required
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" size="sm" disabled={pending || !body.trim()}>
            {pending ? "Posting..." : "Post comment"}
          </Button>
        </form>
      )}
    </div>
  );
}
