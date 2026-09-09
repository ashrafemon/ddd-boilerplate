export abstract class Clock {
  abstract now(): Date;
}

export const SystemClock: Clock = {
  now: () => new Date(),
};
