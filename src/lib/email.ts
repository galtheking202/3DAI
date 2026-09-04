// No "server-only" marker: also imported by the standalone generation worker
// (a plain Node process, not a Next.js build). Never reachable from client code.
import { env } from "@/lib/env";

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (env.EMAIL_TRANSPORT === "console") {
    console.log(
      `\n──────── email ────────\n  to:      ${to}\n  subject: ${subject}\n\n${text}\n────────────────────────\n`,
    );
    return;
  }

  if (env.EMAIL_TRANSPORT === "resend") {
    if (!env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is required when EMAIL_TRANSPORT=resend");
    }
    const { Resend } = await import("resend");
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      text,
    });
    if (error) {
      throw new Error(`Resend send failed: ${error.message}`);
    }
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

export async function sendMagicLink(to: string, url: string): Promise<void> {
  await sendEmail(
    to,
    "Your 3DAI sign-in link",
    `Sign in to 3DAI:\n\n${url}\n\n` +
      `This link expires in 15 minutes. If you didn't request it, you can ignore this email.`,
  );
}

export async function sendSceneReady(to: string, title: string, url: string): Promise<void> {
  await sendEmail(
    to,
    `Your 3D model is ready — ${title}`,
    `"${title}" has finished processing.\n\nView it here:\n${url}`,
  );
}

export async function sendSceneFailed(to: string, title: string, url: string): Promise<void> {
  await sendEmail(
    to,
    `3D generation failed — ${title}`,
    `"${title}" failed to process after several attempts.\n\nYou can retry it here:\n${url}`,
  );
}
