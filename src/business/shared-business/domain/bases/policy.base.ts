export abstract class Policy<T> {
  abstract isSatisfiedBy(target: T): boolean;
}
