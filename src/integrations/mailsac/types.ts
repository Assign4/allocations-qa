export interface MailsacMessage {
  _id: string;
  subject: string;
  from: Array<{ address: string; name: string }>;
  received: string;
}

export interface MailsacClientOptions {
  apiKey: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
}
