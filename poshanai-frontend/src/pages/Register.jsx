import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button as RetroButton, Card as RetroCard, Input as RetroInput } from 'pixel-retroui';
import logo from '../assets/logo.svg';
import { useAuth } from '../hooks/useAuth.js';

const requiredNumber = (label, min, max, integer = false) =>
  z.preprocess(
    (value) => (value === '' || Number.isNaN(value) ? undefined : Number(value)),
    z
      .number({
        required_error: `${label} is required.`,
        invalid_type_error: `${label} is required.`,
      })
      .min(min, `${label} must be at least ${min}.`)
      .max(max, `${label} must be no more than ${max}.`)
      .refine((value) => !integer || Number.isInteger(value), `${label} must be a whole number.`),
  );

const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters.')
      .max(80, 'Name must be 80 characters or fewer.'),
    email: z
      .string()
      .trim()
      .email('Enter a valid email address.')
      .max(254, 'Email must be 254 characters or fewer.')
      .transform((value) => value.toLowerCase()),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .max(128, 'Password must be 128 characters or fewer.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
    age: requiredNumber('Age', 13, 100, true),
    gender: z
      .string()
      .min(1, 'Please select your gender.')
      .refine((value) => ['male', 'female', 'other'].includes(value), 'Select a valid gender.'),
    weightKg: requiredNumber('Weight', 20, 200),
    heightCm: requiredNumber('Height', 100, 250),
    dietType: z
      .string()
      .min(1, 'Please select your diet type.')
      .refine(
        (value) => ['veg', 'non-veg', 'vegan', 'eggetarian'].includes(value),
        'Select a valid diet type.',
      ),
    region: z
      .string()
      .trim()
      .min(2, 'Enter your region or state.')
      .max(100, 'Region must be 100 characters or fewer.'),
    consent: z.boolean().refine((value) => value, 'Please accept the privacy consent to continue.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

const selectClassName =
  'font-minecraft mt-1.5 w-full rounded-none border-2 border-black bg-white px-3 py-2.5 text-black outline-none focus:ring-2 focus:ring-emerald-700';

function RetroInputField({ label, error, helperText, id, ...props }) {
  const inputId = id ?? props.name;
  return (
    <div className="w-full">
      <label
        htmlFor={inputId}
        className="font-minecraft mb-1.5 block text-sm font-medium text-black"
      >
        {label}
      </label>
      <RetroInput
        {...props}
        id={inputId}
        bg="#FFFFFF"
        textColor="#000000"
        borderColor="#000000"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        className="w-full"
      />
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${inputId}-helper`} className="mt-1.5 text-sm text-slate-700">
          {helperText}
        </p>
      )}
    </div>
  );
}

function SelectField({ label, error, children, ...props }) {
  return (
    <div className="w-full">
      <label
        htmlFor={props.id}
        className="font-minecraft mb-1.5 block text-sm font-medium text-black"
      >
        {label}
      </label>
      <select
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${props.id}-error` : undefined}
        className={`${selectClassName} ${error ? '!border-red-600' : ''}`}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p id={`${props.id}-error`} className="mt-1.5 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function Register() {
  const { register: createAccount } = useAuth();
  const navigate = useNavigate();
  const {
    register: registerField,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      age: '',
      gender: '',
      weightKg: '',
      heightCm: '',
      dietType: '',
      region: '',
      consent: false,
    },
  });

  const onSubmit = async (values) => {
    clearErrors('root.serverError');

    try {
      const { name, email, password, age, gender, weightKg, heightCm, dietType, region, consent } =
        values;
      const session = await createAccount({
        name,
        email,
        password,
        age,
        gender,
        weightKg,
        heightCm,
        dietType,
        region,
        consent,
      });
      if (!session.isAuthenticated) {
        setError('root.serverError', {
          type: 'server',
          message: 'Your account was created, but sign-in could not be completed. Please log in.',
        });
        return;
      }

      navigate(session.user?.onboardingCompleted ? '/dashboard' : '/onboarding', { replace: true });
    } catch (error) {
      setError('root.serverError', {
        type: 'server',
        message:
          error?.apiError?.message ||
          error?.message ||
          'Unable to create your account. Please try again.',
      });
    }
  };

  return (
    <main
      aria-labelledby="register-title"
      className="font-minecraft flex min-h-screen items-center justify-center bg-cream px-4 py-8 sm:px-6"
    >
      <RetroCard
        bg="#FFFFFF"
        textColor="#000000"
        borderColor="#000000"
        className="w-full border-2 border-black bg-white p-6 sm:p-8"
      >
        <Link to="/" className="mb-6 inline-flex items-center gap-3" aria-label="PoshanAI home">
          <img src={logo} alt="" className="h-12 w-12 rounded-xl object-contain" />
          <span className="font-minecraft text-xl font-bold text-leaf">PoshanAI</span>
        </Link>
        <h1 id="register-title" className="text-3xl font-bold text-black">
          Create your account
        </h1>
        <p className="mt-2 text-slate-700">
          Create an account and tell us a little about your nutrition preferences.
        </p>

        <form
          className="mt-6 space-y-7"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          aria-label="Create account"
        >
          <fieldset className="space-y-4">
            <legend className="mb-3 text-lg font-semibold text-black">Account details</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <RetroInputField
                label="Name"
                id="register-name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                maxLength={80}
                {...registerField('name')}
                error={errors.name?.message}
              />
              <RetroInputField
                label="Email"
                id="register-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                maxLength={254}
                {...registerField('email')}
                error={errors.email?.message}
              />
              <RetroInputField
                label="Password"
                id="register-password"
                type="password"
                autoComplete="new-password"
                helperText="Use 8 to 128 characters."
                {...registerField('password')}
                error={errors.password?.message}
              />
              <RetroInputField
                label="Confirm password"
                id="register-confirm-password"
                type="password"
                autoComplete="new-password"
                {...registerField('confirmPassword')}
                error={errors.confirmPassword?.message}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-3 text-lg font-semibold text-black">About you</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <RetroInputField
                label="Age"
                id="register-age"
                type="number"
                inputMode="numeric"
                min={13}
                max={100}
                step={1}
                {...registerField('age', { valueAsNumber: true })}
                error={errors.age?.message}
              />
              <SelectField
                id="gender"
                label="Gender"
                defaultValue=""
                {...registerField('gender')}
                error={errors.gender?.message}
              >
                <option value="" disabled>
                  Select gender
                </option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </SelectField>
              <RetroInputField
                label="Weight (kg)"
                id="register-weight"
                type="number"
                inputMode="decimal"
                min={20}
                max={200}
                step="any"
                {...registerField('weightKg', { valueAsNumber: true })}
                error={errors.weightKg?.message}
              />
              <RetroInputField
                label="Height (cm)"
                id="register-height"
                type="number"
                inputMode="decimal"
                min={100}
                max={250}
                step="any"
                {...registerField('heightCm', { valueAsNumber: true })}
                error={errors.heightCm?.message}
              />
              <SelectField
                id="dietType"
                label="Diet type"
                defaultValue=""
                {...registerField('dietType')}
                error={errors.dietType?.message}
              >
                <option value="" disabled>
                  Select diet type
                </option>
                <option value="veg">Vegetarian</option>
                <option value="non-veg">Non-vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="eggetarian">Eggetarian</option>
              </SelectField>
              <RetroInputField
                label="Region or state"
                id="register-region"
                type="text"
                autoComplete="address-level1"
                placeholder="For example, Uttarakhand"
                maxLength={100}
                {...registerField('region')}
                error={errors.region?.message}
              />
            </div>
          </fieldset>

          <label className="flex items-start gap-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 border-2 border-black text-leaf focus:ring-leaf"
              {...registerField('consent')}
            />
            <span>
              I consent to PoshanAI saving my account and profile details to provide the service.
              {errors.consent?.message && (
                <span className="mt-1 block text-red-600 dark:text-red-400" role="alert">
                  {errors.consent.message}
                </span>
              )}
            </span>
          </label>

          {errors.root?.serverError?.message && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
            >
              {errors.root.serverError.message}
            </p>
          )}

          <RetroButton
            bg="#1E5631"
            textColor="#FFFFFF"
            borderColor="#000000"
            shadow="#000000"
            className="mx-0 my-0 w-full justify-center px-5 py-3"
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </RetroButton>
        </form>

        <p className="mt-5 text-sm text-slate-700">
          Already registered?{' '}
          <Link className="font-medium text-leaf underline dark:text-emerald-300" to="/login">
            Sign in
          </Link>
        </p>
      </RetroCard>
    </main>
  );
}
