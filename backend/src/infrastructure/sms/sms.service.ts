import twilio from 'twilio';
import { config } from '../../config';

let _client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!_client) {
    _client = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return _client;
}

/**
 * Send an SMS via Twilio. Falls back to console.log in dev when Twilio isn't configured.
 */
export async function sendSMS(to: string, body: string): Promise<void> {
  if (!config.twilio.enabled) {
    if (config.isDev) {
      console.log(`[SMS] To: ${to} | Body: ${body}`);
    }
    return;
  }

  await getClient().messages.create({
    from: config.twilio.fromNumber,
    to,
    body,
  });
}

/**
 * Send an OTP code via SMS.
 */
export async function sendOTP(phone: string, code: string): Promise<void> {
  const body = `Your Kaero verification code is: ${code}\n\nValid for 5 minutes. Do not share this code.`;
  await sendSMS(phone, body);
}
