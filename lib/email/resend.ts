import { Resend } from "resend";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envío de emails transaccionales (ver blueprint §11). `resend` es un SDK
 * basado en `fetch`, compatible con el runtime de Workers sin APIs de Node.
 */
export async function sendEmail(
  { to, subject, html }: SendEmailInput,
  env: { RESEND_API_KEY: string; RESEND_FROM_EMAIL: string }
) {
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject,
    html,
  });
  if (error) {
    throw new Error(`Resend: no se pudo enviar el email — ${error.message}`);
  }
}
