import 'reflect-metadata';

/**
 * Marks a business adapter as a batch-operation handler opt-in. Everything
 * else (aggregateType, supportedOperations) comes from the handler itself —
 * the scanner registers it and duplicate aggregateTypes throw at boot.
 */
export const BATCH_OPERATION_OPT_IN_METADATA = 'batch-operation-opt-in';

export const BatchOperationOptIn = (): ClassDecorator => {
  return (target: object) => {
    Reflect.defineMetadata(BATCH_OPERATION_OPT_IN_METADATA, true, target);
  };
};
