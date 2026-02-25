import { generateOTP } from '../application/auth.service';

describe('Auth Service', () => {
  test('generateOTP returns a 6-digit string', () => {
    const otp = generateOTP();
    expect(otp).toMatch(/^\d{6}$/);
  });
});