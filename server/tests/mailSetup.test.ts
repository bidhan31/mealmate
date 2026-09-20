import { formatEnvValue, parseFlags, upsertEnvLines } from '../src/mailSetup';

describe('formatEnvValue', () => {
  it('quotes values that contain spaces or special characters', () => {
    expect(formatEnvValue('MealMate <a@b.c>')).toBe('"MealMate <a@b.c>"');
    expect(formatEnvValue('app password with  spaces')).toBe('"app password with  spaces"');
  });

  it('leaves simple values unquoted', () => {
    expect(formatEnvValue('465')).toBe('465');
    expect(formatEnvValue('true')).toBe('true');
    expect(formatEnvValue('smtp.gmail.com')).toBe('smtp.gmail.com');
  });

  it('flattens line breaks and removes double quotes', () => {
    expect(formatEnvValue('a"b\nc')).toBe('"ab c"');
  });
});

describe('upsertEnvLines', () => {
  it('updates existing keys in place and appends new ones', () => {
    const env = '# comment\nSMTP_HOST=old.example.com\nSMTP_USER=keep@me\nMAIL_FROM="Old <old@x>"\n';
    const out = upsertEnvLines(env, {
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      MAIL_FROM: 'MealMate <a@b.c>',
    });

    expect(out).toContain('SMTP_HOST=smtp.gmail.com');
    expect(out).toContain('SMTP_USER=keep@me');
    expect(out).toContain('MAIL_FROM="MealMate <a@b.c>"');
    expect(out).toContain('SMTP_PORT=465');
    expect(out.startsWith('# comment')).toBe(true);
    expect((out.match(/^MAIL_FROM=/gm) ?? []).length).toBe(1); // no duplicate keys
  });

  it('never rewrites commented lines', () => {
    const out = upsertEnvLines('# SMTP_HOST=smtp.gmail.com\n', { SMTP_HOST: 'smtp.gmail.com' });
    expect((out.match(/^SMTP_HOST=/m) ?? []).length).toBe(1); // exactly one active line
    expect(out).toContain('# SMTP_HOST=smtp.gmail.com');
  });

  it('preserves CRLF line endings', () => {
    expect(upsertEnvLines('A=1\r\nB=2\r\n', { B: '3' })).toBe('A=1\r\nB=3\r\n');
  });

  it('appends missing keys under the mail:setup section header', () => {
    const out = upsertEnvLines('NODE_ENV=development\n', { MAIL_PROVIDER: 'smtp' });
    expect(out).toContain('MAIL_PROVIDER=smtp');
    expect(out).toContain('# ── Email delivery (written by mail:setup) ──');
  });
});

describe('parseFlags', () => {
  it('parses smtp flags together with mode switches', () => {
    const flags = parseFlags([
      '--provider', 'smtp',
      '--host', 'smtp.gmail.com',
      '--port', '465',
      '--secure', 'true',
      '--dry-run',
      '--no-test',
    ]);

    expect(flags).toMatchObject({
      provider: 'smtp',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      dryRun: true,
      sendTest: false,
    });
  });

  it('parses brevo credentials and ignores unknown providers', () => {
    const flags = parseFlags([
      '--provider', 'bogus',
      '--api-key', 'xkeysib-1',
      '--from', 'MealMate <a@b.c>',
    ]);

    expect(flags.provider).toBeUndefined();
    expect(flags.apiKey).toBe('xkeysib-1');
    expect(flags.from).toBe('MealMate <a@b.c>');
  });
});