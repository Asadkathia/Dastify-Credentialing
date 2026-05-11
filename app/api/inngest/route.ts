import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { weeklyDigest, dailyDigest } from "@/inngest/functions/digest";
import { expirationAlert } from "@/inngest/functions/expiration-alert";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [weeklyDigest, dailyDigest, expirationAlert],
});
