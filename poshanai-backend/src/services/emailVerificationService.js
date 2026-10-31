import { env } from '../config/env.js';

// TODO: Re-add Resend email verification later.
export async function sendVerificationEmail() {
  if (!env.enableEmailVerification) {
    return { sent: false, reason: 'disabled_for_mvp' };
  }

  throw new Error('Email verification is enabled but its delivery adapter is not implemented.');
}

export default { sendVerificationEmail };
