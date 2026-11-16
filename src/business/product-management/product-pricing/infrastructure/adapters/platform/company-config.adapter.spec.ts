import { CompanyConfigAdapter } from './company-config.adapter';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';

describe('PriceList CompanyConfigAdapter', () => {
  it('uses the request context values', async () => {
    const context = {
      get: jest.fn().mockReturnValue({
        companyId: 'company-1',
        defaultCurrency: 'EUR',
        autoApproveThreshold: 100,
        overReceiptTolerance: 5,
      }),
    };
    const adapter = new CompanyConfigAdapter(context as unknown as RequestContextPort);
    await expect(adapter.getCompanyConfig()).resolves.toMatchObject({
      companyId: 'company-1',
      defaultCurrency: 'EUR',
      autoApproveThreshold: 100,
      overReceiptTolerance: 5,
    });
  });

  it('falls back to defaults without a request context', async () => {
    const adapter = new CompanyConfigAdapter({
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as RequestContextPort);
    await expect(adapter.getCompanyConfig('explicit-company')).resolves.toMatchObject({
      companyId: 'explicit-company',
      defaultCurrency: 'USD',
      isActive: true,
    });
  });
});
