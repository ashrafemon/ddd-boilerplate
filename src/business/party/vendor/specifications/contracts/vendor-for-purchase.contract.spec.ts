import { VendorReference } from '../../public/contracts/vendor-for-purchase.contract';

describe('VendorReference contract', () => {
  const reference: VendorReference = {
    id: 'v-1',
    code: 'V1',
    name: 'Acme',
    email: null,
    phone: null,
    address: null,
    status: 'ACTIVE',
  };

  it('exposes the fields consumers rely on', () => {
    expect(reference).toMatchObject({
      id: 'v-1',
      code: 'V1',
      name: 'Acme',
      email: null,
      phone: null,
      address: null,
      status: 'ACTIVE',
    });
  });
});
