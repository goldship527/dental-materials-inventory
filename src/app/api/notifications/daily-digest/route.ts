import { sendDueDailyDigests } from "@/lib/notifications/daily-digest";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const result = await sendDueDailyDigests();

  return Response.json(result);
}
