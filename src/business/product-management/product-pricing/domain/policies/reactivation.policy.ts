import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { PriceListStatus } from '../types/price-list.enum';
import { PriceListState } from '../types/price-list.types';

policyRegistry.register<PriceListState>('price-list.reactivation', {
  name: 'archived-reactivation',
  evaluate: ({ status }) => {
    return status !== PriceListStatus.ARCHIVED;
  },
});
