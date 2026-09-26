import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth.js';
import { Button, Input } from '../components/common';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [toast, setToast] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), mode: 'onBlur' });

  const onSubmit = async ({ email, password }) => {
    setToast('');
    try {
      const result = await auth.login(email, password);
      if (!result?.success) {
        setToast(result?.error?.message || 'Unable to sign in. Please try again.');
        return;
      }
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setToast(error?.response?.data?.error?.message || error?.message || 'Unable to sign in. Please try again.');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-10 text-slate-800 sm:px-6">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-9"
        aria-labelledby="login-title"
      >
        <a href="/" className="text-lg font-bold text-leaf">PoshanAI</a>
        <h1 id="login-title" className="mt-8 text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Sign in to continue your nutrition awareness journey.</p>

        {toast && (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert" aria-live="assertive">
            {toast}
          </p>
        )}

        <form className="mt-7 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <Input
              id="email"
              type="email"
              label="Email address"
              autoComplete="email"
              required
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
            {errors.email && <p id="email-error" className="mt-1 text-sm text-red-700">{errors.email.message}</p>}
          </div>
          <div>
            <Input
              id="password"
              type="password"
              label="Password"
              autoComplete="current-password"
              required
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            {errors.password && <p id="password-error" className="mt-1 text-sm text-red-700">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-slate-500">
          PoshanAI provides nutrition awareness and suggestions. It does not diagnose or replace advice from a qualified healthcare professional.
        </p>
        <span className="sr-only" role="status" aria-live="polite">{isSubmitting ? 'Signing in' : ''}</span>
      </motion.section>
    </main>
  );
}
