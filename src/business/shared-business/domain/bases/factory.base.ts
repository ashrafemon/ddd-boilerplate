export abstract class DomainFactory<TAggregate, TInput, TProps = unknown> {
  abstract create(input: TInput): TAggregate;

  abstract reconstitute(id: { value: string }, props: TProps, version: number): TAggregate;
}
