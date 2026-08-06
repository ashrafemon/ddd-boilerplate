export class PolicyViolateException extends Error {
  constructor(message: string) {
    super(message);

    this.name = PolicyViolateException.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
