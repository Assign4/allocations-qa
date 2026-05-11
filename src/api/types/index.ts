export interface LoginPayload {
  email: string;
}

export interface VerifyPayload {
  email: string;
  token: string;
  type: 'email';
}

export interface AuthStore {
  email: string;
  otp: string;
}
