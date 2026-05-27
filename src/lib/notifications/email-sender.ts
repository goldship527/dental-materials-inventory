type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type SendEmailResult = {
  status: "sent" | "failed";
  reason: string | null;
};

export function getEmailSenderReadiness() {
  if (process.env.NOTIFICATIONS_ENABLED !== "true") {
    return {
      ready: false,
      reason: "NOTIFICATIONS_ENABLED is not true",
    };
  }

  if (!process.env.RESEND_API_KEY) {
    return {
      ready: false,
      reason: "RESEND_API_KEY is not set",
    };
  }

  if (!process.env.NOTIFICATION_EMAIL_FROM) {
    return {
      ready: false,
      reason: "NOTIFICATION_EMAIL_FROM is not set",
    };
  }

  return {
    ready: true,
    reason: null,
  };
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const readiness = getEmailSenderReadiness();

  if (!readiness.ready) {
    return {
      status: "failed",
      reason: readiness.reason,
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFICATION_EMAIL_FROM,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");

      return {
        status: "failed",
        reason: body ? `Resend error ${response.status}: ${body.slice(0, 500)}` : `Resend error ${response.status}`,
      };
    }

    return {
      status: "sent",
      reason: null,
    };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "メール送信に失敗しました。",
    };
  }
}
