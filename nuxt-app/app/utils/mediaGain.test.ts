import { describe, expect, it, vi } from 'vitest';
import { createMediaGain } from './mediaGain';

function setup(initial = 1) {
  let time = 10;
  const parameter = { cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
  const gain = createMediaGain(parameter, () => time, initial);
  return { gain, parameter, at: (value: number) => { time = value; } };
}

describe('media fade gain', () => {
  it('schedules a linear fade and calculates its current gain', () => {
    const { gain, parameter, at } = setup();
    gain.ramp(0, 5);
    expect(parameter.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 15);
    at(12);
    expect(gain.getSnapshot()).toEqual({ value: 0.6, target: 0, remaining: 3, held: false });
    at(20);
    expect(gain.getSnapshot().value).toBe(0);
  });
  it('holds a ramp and resumes only the remaining duration', () => {
    const { gain, parameter, at } = setup(0);
    gain.ramp(1, 5);
    at(12);
    gain.hold();
    at(100);
    expect(gain.getSnapshot()).toEqual({ value: 0.4, target: 1, remaining: 3, held: true });
    gain.hold();
    gain.resume();
    expect(parameter.setValueAtTime).toHaveBeenLastCalledWith(0.4, 100);
    expect(parameter.linearRampToValueAtTime).toHaveBeenLastCalledWith(1, 103);
    at(103);
    expect(gain.getSnapshot().value).toBe(1);
  });
  it('replaces a running ramp from its interpolated value', () => {
    const { gain, parameter, at } = setup();
    gain.ramp(0, 4);
    at(11);
    gain.ramp(1, 2);
    expect(parameter.setValueAtTime).toHaveBeenLastCalledWith(0.75, 11);
    expect(parameter.linearRampToValueAtTime).toHaveBeenLastCalledWith(1, 13);
  });
  it('clamps unsafe gain and duration inputs', () => {
    const { gain } = setup();
    gain.ramp(10, -5);
    expect(gain.getSnapshot().value).toBe(1);
    gain.ramp(NaN, Infinity);
    expect(gain.getSnapshot()).toMatchObject({ value: 0, remaining: 0 });
  });
  it('silences a retired envelope and rejects later commands', () => {
    const { gain, parameter } = setup();
    gain.stop();
    parameter.setValueAtTime.mockClear();
    gain.ramp(1, 5);
    gain.resume();
    gain.hold();
    expect(parameter.setValueAtTime).not.toHaveBeenCalled();
    expect(gain.getSnapshot().value).toBe(0);
  });
});

describe('smooth (equal power) fades', () => {
  it('follows a sine rise and a cosine fall', () => {
    const rise = setup(0);
    rise.gain.ramp(1, 4, 'smooth');
    for (const [t, expected] of [[10, 0], [11, Math.sin(Math.PI / 8)], [12, Math.SQRT1_2], [13, Math.sin(3 * Math.PI / 8)], [14, 1]] as const) {
      rise.at(t);
      expect(rise.gain.getSnapshot().value).toBeCloseTo(expected, 6);
    }
    const fall = setup(1);
    fall.gain.ramp(0, 4, 'smooth');
    for (const [t, expected] of [[10, 1], [11, Math.cos(Math.PI / 8)], [12, Math.SQRT1_2], [13, Math.cos(3 * Math.PI / 8)], [14, 0]] as const) {
      fall.at(t);
      expect(fall.gain.getSnapshot().value).toBeCloseTo(expected, 6);
    }
  });
  it('keeps a rising and falling pair at steady combined power', () => {
    const rise = setup(0);
    const fall = setup(1);
    rise.gain.ramp(1, 8, 'smooth');
    fall.gain.ramp(0, 8, 'smooth');
    for (let t = 10; t <= 18; t += 0.5) {
      rise.at(t);
      fall.at(t);
      const power = rise.gain.getSnapshot().value ** 2 + fall.gain.getSnapshot().value ** 2;
      expect(power).toBeCloseTo(1, 6);
    }
  });
  it('schedules 32 segments that land on the curve and end exactly on target', () => {
    const { gain, parameter } = setup(0);
    gain.ramp(1, 8, 'smooth');
    const calls = parameter.linearRampToValueAtTime.mock.calls;
    expect(calls).toHaveLength(32);
    expect(calls[15]).toEqual([expect.closeTo(Math.sin(Math.PI / 4), 6), 14]);
    expect(calls[31]).toEqual([1, 18]);
    expect(calls.map(([value]) => value)).toEqual([...calls.map(([value]) => value)].sort((a, b) => a - b));
  });
  it('stays one linear segment when no curve is asked for', () => {
    const { gain, parameter } = setup(0);
    gain.ramp(1, 8);
    expect(parameter.linearRampToValueAtTime).toHaveBeenCalledOnce();
  });
  it('holds a smooth fade and resumes from the held value over the remaining time', () => {
    const { gain, parameter, at } = setup(0);
    gain.ramp(1, 8, 'smooth');
    at(14);
    gain.hold();
    const held = Math.SQRT1_2;
    expect(gain.getSnapshot()).toMatchObject({ value: expect.closeTo(held, 6), remaining: 4, held: true });
    at(50);
    parameter.linearRampToValueAtTime.mockClear();
    gain.resume();
    expect(parameter.setValueAtTime).toHaveBeenLastCalledWith(expect.closeTo(held, 6), 50);
    const calls = parameter.linearRampToValueAtTime.mock.calls;
    expect(calls).toHaveLength(32);
    expect(calls[31]).toEqual([1, 54]);
    at(54);
    expect(gain.getSnapshot().value).toBe(1);
  });
  it('starts a replacement ramp from the interpolated value', () => {
    const { gain, parameter, at } = setup(0);
    gain.ramp(1, 8, 'smooth');
    at(14);
    gain.ramp(0, 2, 'smooth');
    expect(parameter.setValueAtTime).toHaveBeenLastCalledWith(expect.closeTo(Math.SQRT1_2, 6), 14);
    at(16);
    expect(gain.getSnapshot().value).toBe(0);
  });
});
