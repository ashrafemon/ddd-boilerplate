export class InvariantException extends Error {
  constructor(message: string) {
    super(message);

    this.name = InvariantException.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
