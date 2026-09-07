import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy Policy — 3DAI",
  description:
    "What 3DAI collects, how it is used, who it is shared with, and the choices you have.",
};

// Contact address for privacy requests. Swap for a role address (e.g.
// privacy@yourdomain) if you'd rather not use a personal inbox.
const CONTACT = "galshaulker@gmail.com";

const EFFECTIVE = "September 6, 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/"
        className="text-sm font-medium uppercase tracking-widest text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
      >
        3DAI
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-neutral-500">Effective {EFFECTIVE}</p>

      <div className="mt-10 space-y-8 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
        <p>
          This policy explains what information 3DAI (“3DAI”, “we”, “us”) collects
          when you use this website and the 3D capture service offered through it,
          how that information is used, and the choices you have. If you have any
          questions, contact us at{" "}
          <a className="underline underline-offset-2" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          .
        </p>

        <Section title="1. Information we collect">
          <p className="font-medium text-neutral-900 dark:text-neutral-100">
            Information you provide
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Your email address, which you give us to sign in. Sign-in uses
              one-time email links, so we do not store a password for your
              account.
            </li>
            <li>
              Details you add to a capture: a title, an optional description, and
              the type of item (object, apartment or space, vehicle, or other).
            </li>
            <li>The photos and video you upload to build a 3D model.</li>
            <li>
              An optional password you may set on a share link. We store only a
              cryptographic hash of it (scrypt), never the password itself.
            </li>
          </ul>
          <p className="mt-3 font-medium text-neutral-900 dark:text-neutral-100">
            Information collected automatically
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Cookies and similar technologies — see section 3.</li>
            <li>
              Standard server logs recorded by our hosting provider, which may
              include your IP address, browser type and version, the pages you
              request, and the date and time of each request. We use these for
              security, troubleshooting, and keeping the service running.
            </li>
          </ul>
          <p className="mt-3">
            We do not ask for your name, postal address, phone number, or payment
            details, and the service does not take payments.
          </p>
        </Section>

        <Section title="2. How we use information">
          <p>We use the information above to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>create and maintain your account and sign you in;</li>
            <li>
              store your uploads and generate, host, and display your 3D models;
            </li>
            <li>
              create share links and enforce their passwords and expiry dates;
            </li>
            <li>
              send you service email — sign-in links, and notices when a model
              finishes or fails to process;
            </li>
            <li>
              monitor, debug, and secure the service and investigate abuse;
            </li>
            <li>
              display advertising on public share pages where advertising is
              enabled (see section 4);
            </li>
            <li>comply with legal obligations and enforce our agreements.</li>
          </ul>
          <p className="mt-3">
            For users in the EEA, the UK, and Switzerland, our legal bases are:
            performance of a contract (running the service and your account); our
            legitimate interests (security, troubleshooting, preventing abuse);
            compliance with a legal obligation; and your consent (advertising
            cookies, which you can withdraw at any time).
          </p>
        </Section>

        <Section title="3. Cookies and similar technologies">
          <p>We use a small number of cookies:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-mono text-xs">sid</span> — required. Keeps you
              signed in after you use an email link. It is removed when you sign
              out and otherwise expires after about 30 days.
            </li>
            <li>
              <span className="font-mono text-xs">share_…</span> — functional. Set
              only when you enter the correct password for a password-protected
              share page, so you are not asked again on that browser. It holds a
              verification token, not the password.
            </li>
            <li>
              Advertising cookies — set by Google on public share pages when
              advertising is enabled. See section 4.
            </li>
          </ul>
          <p className="mt-3">
            Required and functional cookies are needed for the features you ask
            for and are not used for advertising or cross-site tracking. You can
            block cookies in your browser, but sign-in and password-unlock will
            not work without theirs.
          </p>
        </Section>

        <Section title="4. Advertising">
          <p>
            Where advertising is enabled, we use Google AdSense to show banner ads
            on public share pages (the pages people open from a share link). We do
            not show ads anywhere inside your account.
          </p>
          <p>
            Google and its partners use cookies and similar identifiers to serve
            and measure ads, and, with consent where required, to personalize
            them. In the EEA, the UK, and Switzerland we present a Google-certified
            consent message before any advertising cookie is set, and you can
            change your choice later using the “Privacy” or consent link on those
            pages. Elsewhere, ads may be shown without a prompt in accordance with
            local law.
          </p>
          <p>
            You can control ad personalization in your Google Account at{" "}
            <a
              className="underline underline-offset-2"
              href="https://adssettings.google.com"
              target="_blank"
              rel="noreferrer"
            >
              Google Ads Settings
            </a>
            , and read how Google uses data from sites that use its services at{" "}
            <a
              className="underline underline-offset-2"
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noreferrer"
            >
              policies.google.com/technologies/partner-sites
            </a>
            . Industry opt-out tools are at{" "}
            <a
              className="underline underline-offset-2"
              href="https://optout.aboutads.info"
              target="_blank"
              rel="noreferrer"
            >
              aboutads.info/choices
            </a>{" "}
            and{" "}
            <a
              className="underline underline-offset-2"
              href="https://www.youronlinechoices.eu"
              target="_blank"
              rel="noreferrer"
            >
              youronlinechoices.eu
            </a>
            .
          </p>
        </Section>

        <Section title="5. How we share information">
          <p>
            We do not sell your personal information. We share it only with
            providers that process it on our behalf, under contract and for the
            purposes above:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Railway — application hosting and the database, operated from the
              United States.
            </li>
            <li>
              Cloudflare R2 — object storage for your uploaded media and generated
              models.
            </li>
            <li>
              Resend (or the email provider we configure) — delivery of service
              email.
            </li>
            <li>
              Google AdSense — advertising on public share pages, where enabled.
            </li>
          </ul>
          <p className="mt-3">
            We may also disclose information if required by law, to enforce our
            agreements, to protect the rights, safety, or property of anyone, or
            in connection with a merger, acquisition, or sale of assets, in which
            case we will require the recipient to honor this policy.
          </p>
          <p>
            Depending on your jurisdiction, allowing Google advertising cookies
            may be considered “sharing” of personal information for cross-context
            behavioral advertising. See section 10.
          </p>
        </Section>

        <Section title="6. How your 3D models are generated">
          <p>
            Your uploaded photos and video are stored so a 3D model can be
            produced from them. 3D generation currently runs on an internal
            placeholder engine and your media is not sent to any third-party
            reconstruction service. If that changes — for example, if a
            third-party 3D reconstruction API is enabled — your uploaded media
            will be transmitted to that provider for processing, and this policy
            will be updated to name it before the change takes effect.
          </p>
        </Section>

        <Section title="7. Data retention">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Account and capture data (your email, scenes, uploads, and
              generated models) is kept until you ask us to delete it or delete
              your account.
            </li>
            <li>
              Sign-in links expire 15 minutes after they are issued and can be
              used once.
            </li>
            <li>
              Sessions expire after about 30 days, or immediately when you sign
              out.
            </li>
            <li>
              Signed file links handed to your browser or to share-link visitors
              expire within minutes.
            </li>
            <li>
              Server logs are retained for a limited period by our hosting
              provider and then rotated out.
            </li>
          </ul>
        </Section>

        <Section title="8. Security">
          <p>
            Connections use HTTPS. Share-link passwords are stored only as scrypt
            hashes. Sign-in links are single-use and short-lived. Uploaded files
            and generated models are stored under unguessable keys and served
            through short-lived signed URLs. No online service can be completely
            secure, but we work to protect your information and review our
            practices as the service grows.
          </p>
        </Section>

        <Section title="9. International transfers">
          <p>
            We and our providers process and store information in the United
            States and in other countries where those providers operate. If you
            are in the EEA, the UK, or Switzerland, transfers of your information
            outside your region are made under Standard Contractual Clauses or
            another lawful safeguard.
          </p>
        </Section>

        <Section title="10. Your choices and rights">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              You can stop using the service at any time and ask us to delete
              your account and its data.
            </li>
            <li>
              Manage cookies in your browser; manage advertising consent through
              the consent link on public share pages.
            </li>
            <li>
              EEA / UK / Switzerland: you have the right to access, correct,
              delete, restrict, or object to the processing of your personal
              data, to data portability, and to withdraw consent. You may also
              lodge a complaint with your local supervisory authority.
            </li>
            <li>
              California: you have the right to know, delete, and correct your
              personal information, and to opt out of “sharing” it for
              cross-context behavioral advertising. We do not sell personal
              information, and we will not discriminate against you for
              exercising these rights.
            </li>
          </ul>
          <p className="mt-3">
            To make a request, email{" "}
            <a className="underline underline-offset-2" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            . We may need to verify your identity before acting.
          </p>
        </Section>

        <Section title="11. Children">
          <p>
            The service is not directed to children under 16, and we do not
            knowingly collect their personal information. If you believe a child
            has provided us information, contact us and we will delete it.
          </p>
        </Section>

        <Section title="12. Changes to this policy">
          <p>
            We may update this policy from time to time. We will post the new
            version here and update the “Effective” date above. If the changes are
            significant, we will make a reasonable effort to notify you, for
            example by email.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            Questions or requests:{" "}
            <a className="underline underline-offset-2" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            .
          </p>
        </Section>
      </div>

      <SiteFooter />
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
