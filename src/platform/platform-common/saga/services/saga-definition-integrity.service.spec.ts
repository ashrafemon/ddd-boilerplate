import { ValidateActiveSagaDefinitionsUseCase } from '../use-cases/validate-active-saga-definitions.usecase';
import { SagaDefinitionIntegrityService } from './saga-definition-integrity.service';

/**
 * Unit — the boot sweep must never stop the application from starting.
 *
 * Actions only exist after bootstrap, so this is the first honest moment to ask
 * "is every ACTIVE definition still executable?". A database that is not up yet
 * is a warning, not a crash.
 */
describe('SagaDefinitionIntegrityService', () => {
  function makeSut(result: unknown = { checked: 1, invalidated: [] }) {
    const validateDefinitions = {
      execute: jest.fn(async () => result),
    };
    const service = new SagaDefinitionIntegrityService(
      validateDefinitions as unknown as ValidateActiveSagaDefinitionsUseCase,
    );
    return { service, validateDefinitions };
  }

  it('runs the check on bootstrap', async () => {
    const { service, validateDefinitions } = makeSut();

    await service.onApplicationBootstrap();

    expect(validateDefinitions.execute).toHaveBeenCalledTimes(1);
  });

  it('shouts when definitions were invalidated', async () => {
    const { service } = makeSut({
      checked: 2,
      invalidated: [{ sagaKey: 'goods_receipt', version: 3, problems: ['boom'] }],
    });
    const error = jest.spyOn(service['logger'], 'error');

    await service.onApplicationBootstrap();

    expect(error).toHaveBeenCalledWith(expect.stringContaining('1 of 2 active saga definitions'));
  });

  it('does not fail startup when the check cannot run', async () => {
    const validateDefinitions = {
      execute: jest.fn(async () => {
        throw new Error('db down');
      }),
    };
    const service = new SagaDefinitionIntegrityService(
      validateDefinitions as unknown as ValidateActiveSagaDefinitionsUseCase,
    );
    const warn = jest.spyOn(service['logger'], 'warn');

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });
});
