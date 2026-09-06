// No "server-only" marker: also imported by the standalone generation worker
// (a plain Node process, not a Next.js build). Never reachable from client code.
import { env } from "@/lib/env";

async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
): Promise<void> {
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
      ...(html ? { html } : {}),
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

  await transport.sendMail({ from: env.EMAIL_FROM, to, subject, text, html });
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A plain, one-button HTML email. The button is a real `<a href>` so the
 * recipient clicks through instead of copying a URL; the raw link is repeated
 * below as a fallback for clients that strip the button. Inline styles only —
 * email clients ignore <style> and external CSS.
 */
function linkEmail(opts: {
  heading: string;
  body: string;
  cta: string;
  url: string;
  footer?: string;
}): string {
  const url = esc(opts.url);
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171717;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:32px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#737373;">3DAI</p>
      <h1 style="margin:0 0 16px;font-size:18px;font-weight:600;">${esc(opts.heading)}</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.5;">${esc(opts.body)}</p>
      <p style="margin:0 0 24px;">
        <a href="${url}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 18px;border-radius:8px;">${esc(opts.cta)}</a>
      </p>
      <p style="margin:0;font-size:12px;line-height:1.5;color:#737373;word-break:break-all;">
        Or paste this link into your browser:<br />
        <a href="${url}" style="color:#737373;">${url}</a>
      </p>
      ${
        opts.footer
          ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#a3a3a3;">${esc(opts.footer)}</p>`
          : ""
      }
    </div>
  </body>
</html>`;
}

export async function sendMagicLink(to: string, url: string): Promise<void> {
  await sendEmail(
    to,
    "Your 3DAI sign-in link",
    `Sign in to 3DAI:\n\n${url}\n\n` +
      `This link expires in 15 minutes. If you didn't request it, you can ignore this email.`,
    linkEmail({
      heading: "Sign in to 3DAI",
      body: "Click the button below to sign in. This link expires in 15 minutes.",
      cta: "Sign in",
      url,
      footer: "If you didn't request this, you can ignore this email.",
    }),
  );
}

export async function sendSceneReady(to: string, title: string, url: string): Promise<void> {
  await sendEmail(
    to,
    `Your 3D model is ready — ${title}`,
    `"${title}" has finished processing.\n\nView it here:\n${url}`,
    linkEmail({
      heading: "Your 3D model is ready",
      body: `"${title}" has finished processing.`,
      cta: "View your 3D model",
      url,
    }),
  );
}

export async function sendSceneFailed(to: string, title: string, url: string): Promise<void> {
  await sendEmail(
    to,
    `3D generation failed — ${title}`,
    `"${title}" failed to process after several attempts.\n\nYou can retry it here:\n${url}`,
    linkEmail({
      heading: "3D generation failed",
      body: `"${title}" failed to process after several attempts.`,
      cta: "Retry generation",
      url,
    }),
  );
}
