export type GradeResult = "pass" | "fail";
export type GradeParticleKind = "star" | "note" | "dot" | "drop";

/** One piece of the grade moment: where it travels (px from the centre), when it starts, and what it looks like. */
export interface GradeParticle {
  kind: GradeParticleKind;
  dx: number;
  dy: number;
  delayMs: number;
  sizePx: number;
  spinDeg: number;
}

export const GRADE_PARTICLE_COUNT = 12;

const PASS_KINDS: GradeParticleKind[] = ["star", "note", "dot"];
const PASS_RADII = [190, 150, 120];
const FAIL_SPREAD = 170;

/**
 * A pass bursts outward in a ring; a fail is its quiet mirror, drops that fall
 * from the same spot. Same count and layout rules every time, so the two read
 * as one system and a grade always looks the same.
 */
export function gradeParticles(result: GradeResult): GradeParticle[] {
  const half = (GRADE_PARTICLE_COUNT - 1) / 2;
  return Array.from({ length: GRADE_PARTICLE_COUNT }, (_, i) => {
    if (result === "pass") {
      const angle = (i / GRADE_PARTICLE_COUNT) * Math.PI * 2 + (i % 2 === 0 ? 0 : 0.15);
      const radius = PASS_RADII[i % PASS_RADII.length]!;
      return {
        kind: PASS_KINDS[i % PASS_KINDS.length]!,
        dx: Math.round(Math.cos(angle) * radius),
        dy: Math.round(Math.sin(angle) * radius),
        delayMs: (i % 4) * 30,
        sizePx: 20 + (i % 3) * 6,
        spinDeg: i % 2 === 0 ? 160 : -160,
      };
    }
    return {
      kind: "drop",
      dx: Math.round(((i - half) / half) * FAIL_SPREAD),
      dy: 170 + (i % 3) * 45,
      delayMs: (i % 5) * 45,
      sizePx: 20 + (i % 3) * 5,
      spinDeg: 0,
    };
  });
}
