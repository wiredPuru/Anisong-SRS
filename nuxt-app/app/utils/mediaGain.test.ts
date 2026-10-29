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
