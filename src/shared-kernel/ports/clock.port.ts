export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export const SystemClock: Clock = {
  now: () => new Date(),
};
