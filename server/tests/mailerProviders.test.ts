import nodemailer from 'nodemailer';
import { env } from '../src/config/env';
import { configuredFrom, resolveMailProvider, sendMailViaSmtp } from '../src/utils/mailer';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));

const createTransport = nodemailer.createTransport as unknown as jest.Mock;
const sendMailMock = jest.fn();
const verifyMock = jest.fn();

beforeEach(() => {
  sendMailMock.mockReset().mockResolvedValue({ messageId: '<id@mealmate.test>' });
  verifyMock.mockReset().mockResolvedValue(true);
  createTransport.mockReturnValue({ sendMail: sendMailMock, verify: verifyMock });
});

describe('resolveMailProvider', () => {
  it('prefers an explicit MAIL_PROVIDER value', () => {
    expect(resolveMailProvider({ explicit: 'smtp', brevoKey: 'xkeysib-123' })).toBe('smtp');
    expect(resolveMailProvider({ explicit: 'brevo', smtpHost: 'h', smtpUser: 'u', smtpPass: 'p' })).toBe(
      'brevo',
    );
    expect(
      resolveMailProvider({ explicit: 'console', brevoKey: 'k', smtpHost: 'h', smtpUser: 'u', smtpPass: 'p' }),
    ).toBe('console');
  });

  it('auto-detects Brevo when an API key is present', () => {
    expect(resolveMailProvider({ brevoKey: 'xkeysib-abc' })).toBe('brevo');
  });

  it('auto-detects SMTP when host, user and password are present', () => {
    expect(resolveMailProvider({ smtpHost: 'smtp.gmail.com', smtpUser: 'a@gmail.com', smtpPass: 'pw' })).toBe(
      'smtp',
    );
  });

  it('falls back to console logging when nothing (or only part of SMTP) is configured', () => {
    expect(resolveMailProvider({})).toBe('console');
    expect(resolveMailProvider({ smtpHost: 'smtp.gmail.com', smtpUser: 'a@gmail.com' })).toBe('console');
  });

  it('reports the real provider of this test environment', () => {
    // No BREVO_API_KEY / SMTP_* in tests → console fallback
    expect(resolveMailProvider()).toBe('console');
  });
});

describe('sendMailViaSmtp', () => {
  it('builds the transport from SMTP_* settings and sends the message', async () => {
    await sendMailViaSmtp({
      to: 'resident@mealmate.test',
      subject: 'Verify your MealMate account',
      html: '<p>click the link</p>',
      text: 'click the link',
    });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: env.SMTP_PORT, secure: false }),
    );
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: configuredFrom(),
        to: 'resident@mealmate.test',
        subject: 'Verify your MealMate account',
        html: '<p>click the link</p>',
        text: 'click the link',
      }),
    );
  });

  it('propagates transport failures so sendMail can report them to the caller', async () => {
    sendMailMock.mockRejectedValue(
      Object.assign(new Error('Invalid login: 535-5.7.8 Username and Password not accepted'), {
        code: 'EAUTH',
        response: '535-5.7.8 Username and Password not accepted',
      }),
    );

    await expect(
      sendMailViaSmtp({ to: 'resident@mealmate.test', subject: 'x', html: '<p>x</p>' }),
    ).rejects.toThrow(/535-5\.7\.8/);
  });
});