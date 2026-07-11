export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export type SendEmail = (message: EmailMessage) => Promise<void>;

// TODO: replace with a real provider (Resend, Cloudflare Email Service, SES)
export const sendEmail: SendEmail = async (message) => {
  console.log(`[email] to=${message.to} subject=${message.subject}\n${message.text}`);
};
