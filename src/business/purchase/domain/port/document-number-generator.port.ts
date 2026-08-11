/**
 * Domain port: generates human-readable document numbers for purchase orders.
 * Implemented by an infrastructure adapter.
 */
export abstract class DocumentNumberGeneratorPort {
  public abstract generate(prefix: string): Promise<string>;
}
