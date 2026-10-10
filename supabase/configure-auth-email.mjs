// Points Supabase Auth's email at Brevo and sets the six-digit code emails —
// everything "Authentication → Emails" needs, in one call to the management API.
//
//   SUPABASE_ACCESS_TOKEN=…  (supabase.com/dashboard/account/tokens)
//   BREVO_SMTP_LOGIN=…       (Brevo → SMTP & API → SMTP: "Login")
//   BREVO_SMTP_KEY=…         (Brevo → SMTP & API → SMTP: an SMTP key)
//   node supabase/configure-auth-email.mjs
//
// Secrets are read from the environment only; nothing is written to disk.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = 'kgsqewtdznpclcdwdqes';
const SENDER = 'getlowkei@gmail.com';

const { SUPABASE_ACCESS_TOKEN: token, BREVO_SMTP_LOGIN: login, BREVO_SMTP_KEY: key } = process.env;
if (!token || !login || !key) {
  console.error('Set SUPABASE_ACCESS_TOKEN, BREVO_SMTP_LOGIN and BREVO_SMTP_KEY.');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const template = name => readFileSync(join(here, 'email-templates', `${name}.html`), 'utf8').replace(/^<!--[\s\S]*?-->\s*/, '');

const body = {
  external_email_enabled: true,
  mailer_otp_length: 6,
  smtp_admin_email: SENDER,
  smtp_sender_name: 'Lowkei',
  smtp_host: 'smtp-relay.brevo.com',
  smtp_port: '587',
  smtp_user: login,
  smtp_pass: key,
  mailer_subjects_confirmation: 'Your Lowkei code',
  mailer_templates_confirmation_content: template('confirm-signup'),
  mailer_subjects_magic_link: 'Your Lowkei sign-in code',
  mailer_templates_magic_link_content: template('magic-link'),
  mailer_subjects_email_change: 'Keep your Lowkei space',
  mailer_templates_email_change_content: template('change-email')
};

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});
const text = await res.text();
if (!res.ok) {
  console.error(`Supabase said ${res.status}: ${text.slice(0, 400)}`);
  process.exit(1);
}
const saved = JSON.parse(text);
console.log('Saved.', { smtp_host: saved.smtp_host, smtp_user: saved.smtp_user, sender: saved.smtp_admin_email, otp_length: saved.mailer_otp_length });
