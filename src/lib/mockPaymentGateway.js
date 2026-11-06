export class MockPaymentGateway {
  async charge({ shouldDecline = false } = {}) {
    return shouldDecline ? { success: false } : { success: true };
  }
}

export function createMockPaymentGateway() {
  return new MockPaymentGateway();
}
