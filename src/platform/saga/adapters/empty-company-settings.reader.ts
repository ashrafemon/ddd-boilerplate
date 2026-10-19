import { Injectable } from '@nestjs/common';
import { CompanySettingsReader } from '../ports/company-settings.port';

/**
 * Empty default: until a settings source is wired, the plan build sees no
 * company settings. `requires` keys therefore resolve to "absent" and a saga
 * gated on them stays off — never a crash.
 */
@Injectable()
export class EmptyCompanySettingsReader extends CompanySettingsReader {
  get(): Promise<Record<string, unknown>> {
    return Promise.resolve({});
  }
}
