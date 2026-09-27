import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button, Input } from '../components/common/index.js';
import { useAuth } from '../hooks/useAuth.js';
import logo from '../assets/logo.png';

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(100),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.').max(128),
  confirmPassword: z.string(),
  age: z.coerce.number().int().min(1).max(120),
  gender: z.string().trim().min(1, 'Select an option.'),
  weightKg: z.coerce.number().min(1).max(500),
  heightCm: z.coerce.number().min(30).max(300),
  dietType: z.enum(['veg', 'non-veg', 'vegan']),
  region: z.string().trim().max(100).optional(),
  activityLevel: z.string().trim().max(50).optional(),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

export default function Register() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { dietType: 'veg' },
  });

  const onSubmit = async ({ confirmPassword, ...values }) => {
    setFormError('');
    const result = await auth.register({ ...values, allergies: [] });
    if (!result?.success) {
      setFormError(result?.error?.message || 'Unable to create your account. Please try again.');
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <main className="bg-cream px-4 py-8 text-slate-800 sm:px-6">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="mx-auto w-full max-w-2xl rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-9"
        aria-labelledby="register-title"
      >
        <Link to="/" className="mx-auto flex w-fit flex-col items-center text-center" aria-label="PoshanAI home">
          <img src={logo} alt="" className="mb-3 h-20 w-20 rounded-full object-cover" />
          <span className="font-heading text-xl font-bold text-leaf">Poshan<span className="text-orange">AI</span></span>
        </Link>
        <h1 id="register-title" className="mt-5 text-center text-3xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-2 text-center text-sm text-slate-600">Add a few details to personalize your nutrition experience.</p>

        {formError && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{formError}</p>}

        <form className="mt-7 grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} />
          <Input label="Email address" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <Input label="Password" type="password" autoComplete="new-password" helperText="At least 8 characters." error={errors.password?.message} {...register('password')} />
          <Input label="Confirm password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
          <Input label="Age" type="number" min="1" max="120" error={errors.age?.message} {...register('age')} />
          <label className="block w-full text-sm font-medium text-slate-800">Gender
            <select className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf" {...register('gender')}>
              <option value="">Select an option</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer not to say">Prefer not to say</option>
            </select>
            {errors.gender && <span className="mt-1 block text-sm text-red-700">{errors.gender.message}</span>}
          </label>
          <Input label="Weight (kg)" type="number" min="1" max="500" step="0.1" error={errors.weightKg?.message} {...register('weightKg')} />
          <Input label="Height (cm)" type="number" min="30" max="300" step="0.1" error={errors.heightCm?.message} {...register('heightCm')} />
          <label className="block w-full text-sm font-medium text-slate-800">Diet preference
            <select className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf" {...register('dietType')}>
              <option value="veg">Vegetarian</option><option value="non-veg">Non-vegetarian</option><option value="vegan">Vegan</option>
            </select>
          </label>
          <Input label="Region (optional)" error={errors.region?.message} {...register('region')} />
          <div className="sm:col-span-2">
            <Button type="submit" className="w-full" loading={isSubmitting}>Create account</Button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">Already registered? <Link to="/login" className="font-semibold text-leaf underline-offset-2 hover:underline">Sign in</Link></p>
        <p className="mt-5 text-center text-xs leading-5 text-slate-500">PoshanAI provides nutrition awareness and suggestions. It does not diagnose or replace advice from a qualified healthcare professional.</p>
      </motion.section>
    </main>
  );
}
