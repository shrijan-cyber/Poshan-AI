import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components/common/index.js';
import logo from '../assets/logo.svg';
import { useToast } from '../components/common/Toast.jsx';
import { useAuth } from '../hooks/useAuth.js';

export default function TwoFactorVerify() {
  const {
    hasPendingTwoFactor,
    twoFactorExpiresAt,
    verifyTwoFactor,
    cancelTwoFactor,
  } = useAuth();
  const [code, setCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(300);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (!hasPendingTwoFactor) return undefined;
    const updateRemaining = () => {
      setSecondsLeft(Math.max(0, Math.ceil(((twoFactorExpiresAt ?? 0) - Date.now()) / 1000)));
    };
    const timer = window.setInterval(updateRemaining, 250);
    return () => window.clearInterval(timer);
  }, [hasPendingTwoFactor, twoFactorExpiresAt]);

  useEffect(() => {
    if (hasPendingTwoFactor && secondsLeft === 0) {
      cancelTwoFactor();
      navigate('/login', { replace: true });
    }
  }, [hasPendingTwoFactor, secondsLeft, cancelTwoFactor, navigate]);

  if (!hasPendingTwoFactor) return <Navigate to="/login" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await verifyTwoFactor(code.trim());
      toast('Two-factor verification complete.', 'success');
      navigate('/dashboard', { replace: true });
    } catch (verifyError) {
      const message = verifyError?.apiError?.message || verifyError?.message || 'Could not verify your code.';
      setError(message);
      toast(message, 'error');
      const status = verifyError?.response?.status ?? verifyError?.apiError?.status;
      if (status === 401) {
        cancelTwoFactor();
        navigate('/login', { replace: true });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-cream p-4 dark:bg-slate-950 sm:p-6">
      <section aria-labelledby="two-factor-title" className="relative z-10 w-full max-w-md rounded-2xl border border-white/70 bg-white/95 p-6 shadow-xl backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/95 sm:p-8">
        <Link to="/login" onClick={cancelTwoFactor} className="mb-6 inline-flex items-center gap-3" aria-label="Back to PoshanAI sign in">
          <img src={logo} alt="" className="h-12 w-12 rounded-xl object-contain" />
          <span className="text-xl font-bold text-leaf dark:text-emerald-300">PoshanAI</span>
        </Link>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800 dark:text-emerald-300">Account security</p>
        <h1 id="two-factor-title" className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Two-step verification</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {useBackupCode
            ? 'Enter one of the backup codes you saved when enabling two-factor authentication. Each code works once.'
            : 'Enter the six-digit code from your authenticator app to finish signing in.'}
        </p>
        <p className="mt-3 text-sm font-semibold text-emerald-800 dark:text-emerald-300" aria-live="polite">
          Code expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')} minutes
        </p>

        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          <label htmlFor="two-factor-code" className="block text-sm font-medium text-slate-800 dark:text-slate-100">
            {useBackupCode ? 'Backup code' : 'Authenticator code'}
          </label>
          <input
            id="two-factor-code"
            type="text"
            inputMode={useBackupCode ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            autoFocus
            required
            maxLength={useBackupCode ? 10 : 6}
            pattern={useBackupCode ? '[A-Fa-f0-9]{10}' : '[0-9]{6}'}
            value={code}
            onChange={(event) => setCode(useBackupCode ? event.target.value.toUpperCase().replace(/[^A-F0-9]/g, '') : event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={useBackupCode ? '10-character code' : '000000'}
            aria-describedby={error ? 'two-factor-error' : undefined}
            aria-invalid={Boolean(error)}
            className={`w-full rounded-xl border bg-white px-3 py-3 text-center text-xl text-slate-900 outline-none focus:ring-2 dark:bg-slate-800 dark:text-white ${error ? 'border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-forest focus:ring-forest/20 dark:border-slate-700'}`}
          />
          {error && <p id="two-factor-error" role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Button className="w-full px-5 py-3" type="submit" loading={isSubmitting} disabled={secondsLeft === 0 || code.length !== (useBackupCode ? 10 : 6)}>
            {isSubmitting ? 'Verifying…' : 'Verify and sign in'}
          </Button>
        </form>

        <button
          type="button"
          className="mt-5 text-sm font-semibold text-emerald-800 underline underline-offset-4 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-emerald-200"
          onClick={() => { setUseBackupCode((current) => !current); setCode(''); setError(''); }}
        >
          {useBackupCode ? 'Use an authenticator app instead' : 'Use a backup code'}
        </button>
      </section>
    </main>
  );
}
