import { describe, expect, it } from "vitest";
import { GRADE_PARTICLE_COUNT, gradeParticles } from "./gradeParticles";

describe("gradeParticles", () => {
  it("gives a pass and a fail the same number of particles", () => {
    expect(gradeParticles("pass")).toHaveLength(GRADE_PARTICLE_COUNT);
    expect(gradeParticles("fail")).toHaveLength(GRADE_PARTICLE_COUNT);
  });

  it("is the same every time", () => {
    expect(gradeParticles("pass")).toEqual(gradeParticles("pass"));
    expect(gradeParticles("fail")).toEqual(gradeParticles("fail"));
  });

  it("bursts a pass outward in every direction with stars, notes and dots", () => {
    const pass = gradeParticles("pass");
    expect(new Set(pass.map((p) => p.kind))).toEqual(new Set(["star", "note", "dot"]));
    expect(pass.some((p) => p.dx > 0)).toBe(true);
    expect(pass.some((p) => p.dx < 0)).toBe(true);
    expect(pass.some((p) => p.dy > 0)).toBe(true);
    expect(pass.some((p) => p.dy < 0)).toBe(true);
  });

  it("lets a fail fall: every drop moves down, spread evenly left and right", () => {
    const fail = gradeParticles("fail");
    expect(fail.every((p) => p.kind === "drop")).toBe(true);
    expect(fail.every((p) => p.dy > 0)).toBe(true);
    expect(Math.min(...fail.map((p) => p.dx))).toBe(-170);
    expect(Math.max(...fail.map((p) => p.dx))).toBe(170);
  });

  it("starts every particle within a quarter second", () => {
    for (const result of ["pass", "fail"] as const) {
      expect(Math.max(...gradeParticles(result).map((p) => p.delayMs))).toBeLessThan(250);
    }
  });
});
