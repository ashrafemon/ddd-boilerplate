import { NoOpTransactionalAdapter, TransactionHost } from '@nestjs-cls/transactional';

/**
 * Registers the default TransactionHost singleton using the NoOp adapter so
 * unit tests can exercise `@Transactional`-decorated use cases without a
 * database. Must be called once before constructing decorated use cases.
 */
export function initNoopTransactionHost(): void {
  const adapter = new NoOpTransactionalAdapter({ tx: {}, disableWarning: true });
  const options = adapter.optionsFactory({});
  // The TransactionHost constructor registers itself in the static instance
  // map that `@Transactional` reads through TransactionHost.getInstance().
  new TransactionHost({
    ...options,
    connectionName: undefined,
    enableTransactionProxy: false,
    defaultTxOptions: {},
    extraProviderTokens: [],
  } as never);
}

/**
 * Indicates whether the default TransactionHost singleton has been registered.
 */
export function isNoopTransactionHostRegistered(): boolean {
  try {
    TransactionHost.getInstance();
    return true;
  } catch {
    return false;
  }
}
