import "server-only";
import { env } from "@/lib/env";

export async function sendMagicLink(to: string, url: string): Promise<void> {
  const subject = "Your 3DAI sign-in link";
  const text =
    `Sign in to 3DAI:\n\n${url}\n\n` +
    `This link expires in 15 minutes. If you didn't request it, you can ignore this email.`;

  if (env.EMAIL_TRANSPORT === "console") {
    console.log(
      `\n──────── magic link ────────\n  to:   ${to}\n  link: ${url}\n────────────────────────────\n`,
    );
    return;
  }

  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 1025,
    secure: false,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  await transport.sendMail({ from: env.EMAIL_FROM, to, subject, text });
}
