export class VendorEmailInvariants {
  static enforceVendorEmail(email: string): void {
    if (!email) return;
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw Object.assign(new Error('Invalid vendor email'), { statusCode: 422 });
    }
  }
}
