import { getResendApiKey } from "@/lib/env";

export function getResendFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || "Bitewise <onboarding@resend.dev>";
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
    headers: {
      Authorization: `Bearer ${getResendApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: getResendFromEmail(), to: [to], subject, html }),
  });
  if (!response.ok) throw new Error(`Resend returned status ${response.status}`);
}

export async function sendDeletionConfirmation(to: string, deletionDate: string): Promise<void> {
  await sendEmail(
    to,
    "Your Bitewise account is scheduled for deletion",
    `<p>Your Bitewise account is scheduled for permanent deletion on <strong>${deletionDate}</strong>.</p><p>You can cancel this within 14 days by signing in. Your data remains untouched during the grace period.</p>`,
  );
}

export async function sendDeletionReminder(to: string, deletionDate: string): Promise<void> {
  await sendEmail(
    to,
    "Reminder: your Bitewise account will be deleted soon",
    `<p>Your Bitewise account is scheduled for permanent deletion on <strong>${deletionDate}</strong>.</p><p>Sign in before then if you want to cancel deletion.</p>`,
  );
}
