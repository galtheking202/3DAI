/**
 * Engine identifiers, kept in a dependency-free module so client components and
 * route handlers can import the list and validator without pulling in the
 * generator classes (and their aws-sdk / fflate weight).
 */

/** Engines a user can pick in the UI. `atlas` is defined but not implemented. */
export const SELECTABLE_GENERATORS = ["mock", "meshy", "kiri"] as const;

export type SelectableGenerator = (typeof SELECTABLE_GENERATORS)[number];

export function isSelectableGenerator(v: unknown): v is SelectableGenerator {
  return (
    typeof v === "string" &&
    (SELECTABLE_GENERATORS as readonly string[]).includes(v)
  );
}

/** Short labels for the picker. */
export const GENERATOR_LABEL: Record<SelectableGenerator, string> = {
  mock: "Mock — bundled sample (testing)",
  meshy: "Meshy — fast, generative (objects)",
  kiri: "KIRI — photogrammetry, measured",
};
