import {
  fromCommandEnvelope,
  fromResultEnvelope,
  SAGA_COMMAND_ROUTING_KEY,
  SAGA_STEP_RESULT_ROUTING_KEY,
  SagaStepCommand,
  SagaStepResult,
  toCommandEnvelope,
  toResultEnvelope,
} from './saga-command.types';
import { SagaStepKind } from './saga.types';

/**
 * Unit — the two messages that carry saga work across the broker.
 *
 * The envelopes must survive the wire round trip intact: a lost `tenantId`
 * breaks routing, a lost `stepRowId` breaks settling, and a lost
 * `correlationKey` breaks correlation matching.
 */
describe('saga command/result envelopes', () => {
  const command: SagaStepCommand = {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    sagaKey: 'goods_receipt',
    instanceId: 'instance-1',
    stepId: 'valuate',
    stepRowId: 'step-row-1',
    kind: SagaStepKind.DO,
    action: 'inventory.valuation.posted',
    correlationKey: 'GRN:grn-1',
    input: { grnId: 'grn-1' },
  };

  const result: SagaStepResult = {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    instanceId: 'instance-1',
    stepId: 'valuate',
    stepRowId: 'step-row-1',
    kind: SagaStepKind.DO,
    outcome: 'ok',
    output: { unitCosts: [1, 2] },
    error: null,
  };

  it('labels a command with its own routing key and saga aggregate', () => {
    const envelope = toCommandEnvelope(command);

    expect(envelope.eventType).toBe(SAGA_COMMAND_ROUTING_KEY);
    expect(envelope.aggregateType).toBe('Saga');
    expect(envelope.aggregateId).toBe('instance-1');
    expect(envelope.eventId).toBe('step-row-1:command');
  });

  it('round-trips a command', () => {
    const back = fromCommandEnvelope(toCommandEnvelope(command).payload);

    expect(back).toEqual(command);
  });

  it('defaults a command without kind or doOutput', () => {
    const back = fromCommandEnvelope({ ...toCommandEnvelope(command).payload, kind: 'weird' });

    expect(back?.kind).toBe(SagaStepKind.DO);
    expect(back?.doOutput).toBeUndefined();
  });

  it('rejects a delivery that is not a command', () => {
    expect(fromCommandEnvelope(null)).toBeNull();
    expect(fromCommandEnvelope({ instanceId: 'x' })).toBeNull();
    expect(fromCommandEnvelope({ ...command, action: undefined })).toBeNull();
  });

  it('labels a result with its own routing key and round-trips it', () => {
    const envelope = toResultEnvelope(result);
    expect(envelope.eventType).toBe(SAGA_STEP_RESULT_ROUTING_KEY);
    expect(fromResultEnvelope(envelope.payload)).toEqual(result);
  });

  it('coerces an unknown outcome to fail rather than stranding the step', () => {
    const back = fromResultEnvelope({ ...toResultEnvelope(result).payload, outcome: 'weird' });

    expect(back?.outcome).toBe('fail');
  });

  it('rejects a delivery that is not a result', () => {
    expect(fromResultEnvelope(undefined)).toBeNull();
    expect(fromResultEnvelope({ instanceId: 'x', stepId: 'y' })).toBeNull();
  });
});
