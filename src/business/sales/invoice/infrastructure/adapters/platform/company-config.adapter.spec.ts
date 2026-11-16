import { CompanyConfigAdapter } from './company-config.adapter';
import { CompanyConfigPort } from '@platform/platform-organization/configuration/ports/company-config.port';

describe('Invoice CompanyConfigAdapter', () => {
  it('delegates to the platform company config', async () => {
    const platform = { getCompanyConfig: jest.fn().mockResolvedValue({ companyId: 'c-1' }) };
    const adapter = new CompanyConfigAdapter(platform);
    await expect(adapter.getCompanyConfig()).resolves.toEqual({ companyId: 'c-1' });
    expect(platform.getCompanyConfig).toHaveBeenCalled();
    expect(adapter).toBeInstanceOf(CompanyConfigAdapter);
    expect(platform as unknown as CompanyConfigPort).toBeDefined();
  });
});
