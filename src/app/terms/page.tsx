import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Terms of Service — 3DAI",
  description: "The terms for using 3DAI, an early-preview 3D capture and sharing service.",
};

const CONTACT = "galshaulker@gmail.com";
const EFFECTIVE = "September 7, 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/"
        className="text-sm font-medium uppercase tracking-widest text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
      >
        3DAI
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-neutral-500">Effective {EFFECTIVE}</p>

      <div className="mt-10 space-y-8 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
        <p>
          These terms are an agreement between you and 3DAI (“3DAI”, “we”, “us”)
          for use of this website and the 3D capture and sharing service offered
          through it (the “Service”). By using the Service you agree to these
          terms. If you do not agree, do not use the Service.
        </p>

        <Section title="1. What the Service is">
          <p>
            3DAI lets you upload a walkthrough video and photos of an object,
            space, or vehicle, turns them into a 3D model, and lets you share
            that model as a link whose access you control. The Service is an
            early preview: features may change, break, or be removed, and it is
            provided without any guarantee of availability.
          </p>
        </Section>

        <Section title="2. Your account">
          <p>
            You sign in with a one-time link sent to your email address. There is
            no password. You are responsible for keeping access to your email
            account secure, and for activity that happens under your account. Let
            us know promptly if you believe someone else has accessed it.
          </p>
        </Section>

        <Section title="3. Your content">
          <p>
            You keep ownership of the video, photos, and other material you
            upload, and of the 3D models generated from them (“your content”).
            You grant us a limited licence to host, store, process, and display
            your content solely to operate the Service for you — for example, to
            generate a model, to show it to you, and to serve it to people you
            share a link with.
          </p>
          <p>
            You are responsible for your content. You represent that you have the
            rights to upload it and to have it processed and shared this way, and
            that it does not infringe anyone else’s rights or break the law.
          </p>
        </Section>

        <Section title="4. Acceptable use">
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              upload or share content you do not have the rights to, or that is
              unlawful, infringing, deceptive, or harmful;
            </li>
            <li>
              capture or share a space, vehicle, or person without the consent
              you are legally required to have;
            </li>
            <li>
              probe, disrupt, overload, or attempt to gain unauthorised access to
              the Service, its infrastructure, or other users’ content;
            </li>
            <li>
              resell or redistribute the Service itself, or use it to build a
              competing dataset by bulk extraction.
            </li>
          </ul>
          <p className="mt-3">
            We may suspend or remove content or accounts that break these rules,
            or where we are required to by law.
          </p>
        </Section>

        <Section title="5. Share links">
          <p>
            When you create a share link you decide whether it has a password and
            when it expires, and you can revoke it at any time. Anyone who has a
            live link can view the model, so share links carefully. Because a
            model is downloaded to a viewer’s browser to be displayed, revoking a
            link stops future access but cannot retrieve what someone has already
            viewed.
          </p>
        </Section>

        <Section title="6. Availability and changes">
          <p>
            The Service is provided on an “as is” and “as available” basis, with
            no service-level commitment. We may change, suspend, or discontinue
            any part of it at any time, and we may set limits on storage, file
            sizes, or usage.
          </p>
        </Section>

        <Section title="7. Disclaimer">
          <p>
            To the fullest extent permitted by law, we disclaim all warranties,
            express or implied, including fitness for a particular purpose and
            non-infringement. We do not warrant that the Service will be
            uninterrupted, error-free, or that generated models will be accurate
            or complete.
          </p>
        </Section>

        <Section title="8. Limitation of liability">
          <p>
            To the fullest extent permitted by law, we will not be liable for any
            indirect, incidental, special, or consequential damages, or for lost
            data, revenue, or profits, arising out of your use of the Service.
            Nothing in these terms limits liability that cannot be limited under
            applicable law.
          </p>
        </Section>

        <Section title="9. Termination">
          <p>
            You may stop using the Service and ask us to delete your account and
            its content at any time. We may suspend or terminate your access if
            you break these terms or if we stop offering the Service. Sections
            that by their nature should survive termination (content licence
            wind-down, disclaimers, limitation of liability) will survive.
          </p>
        </Section>

        <Section title="10. Changes to these terms">
          <p>
            We may update these terms from time to time. We will post the new
            version here and update the “Effective” date. If the changes are
            significant we will make a reasonable effort to let you know. By
            continuing to use the Service after a change takes effect, you accept
            the updated terms.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Questions about these terms:{" "}
            <a className="underline underline-offset-2" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            . See also our{" "}
            <Link className="underline underline-offset-2" href="/privacy">
              Privacy Policy
            </Link>
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
