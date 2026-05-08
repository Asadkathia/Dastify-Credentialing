import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { recredCheck } from "@/inngest/functions/recred-check";
import { weeklyDigest, dailyDigest } from "@/inngest/functions/digest";
import { expirationAlert } from "@/inngest/functions/expiration-alert";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [recredCheck, weeklyDigest, dailyDigest, expirationAlert],
});
