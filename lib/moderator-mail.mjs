import nodemailer from 'nodemailer';

function publicOrigin() {
  const value = process.env.PUBLIC_ORIGIN?.trim();
  if (!value) throw new Error('PUBLIC_ORIGIN is required to send moderator activation links.');
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('PUBLIC_ORIGIN must use HTTPS outside localhost.');
  return url;
}

export function moderatorEmailConfigured() {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASSWORD?.trim() && process.env.SMTP_FROM?.trim() && process.env.PUBLIC_ORIGIN?.trim());
}

export function smtpOptions(env = process.env) {
  const port = Number(env.SMTP_PORT || 465);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error('SMTP_PORT must be a valid port number.');
  return {
    host: env.SMTP_HOST.trim(),
    port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465,
    auth: { user: env.SMTP_USER.trim(), pass: env.SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  };
}

export async function sendModeratorActivation({ email, nickname, token }) {
  if (!moderatorEmailConfigured()) throw new Error('Moderator email is not configured.');
  const activation = new URL('/moderator', publicOrigin());
  activation.searchParams.set('token', token);
  const result = await nodemailer.createTransport(smtpOptions()).sendMail({
    from: process.env.SMTP_FROM.trim(),
    to: email,
    subject: 'Attiva il tuo accesso da moderatore — Punto Sicuro',
    text: `Ciao ${nickname},\n\nla tua candidatura è stata approvata. Imposta una password personale entro 48 ore: ${activation}\n\nNon inoltrare questo link. Se non hai richiesto questo accesso, ignora questa email.`,
  });
  if (!result.messageId) throw new Error('Activation email could not be sent.');
}
