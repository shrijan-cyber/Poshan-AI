import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { getApiError } from '../api/client.js';
import { submitOnboarding } from '../api/lifestyleApi.js';
import { Button, useToast } from '../components/common/index.js';
import OnboardingProgress from '../components/lifestyle/OnboardingProgress.jsx';
import {
  ChipGroup,
  ChoiceGrid,
  ConsentCheckbox,
  RangeField,
  Stepper,
} from '../components/lifestyle/OptionControls.jsx';
import {
  ACTIVITY_OPTIONS,
  DIET_OPTIONS,
  HABIT_OPTIONS,
  SLEEP_TIME_OPTIONS,
  STEP_TITLES,
  SUN_OPTIONS,
  SYMPTOM_OPTIONS,
  TYPICAL_DIET_OPTIONS,
} from '../components/lifestyle/options.js';
import {
  INITIAL_LIFESTYLE_VALUES,
  STEP_FIELDS,
  buildOnboardingPayload,
  onboardingSchema,
} from '../utils/lifestyleSchemas.js';
import { useAuth } from '../hooks/useAuth.js';

const TOTAL_STEPS = STEP_TITLES.length;

// "None" cannot be combined with other answers (the API enforces the same rule).
function toggleExclusive(list, value) {
  if (value === 'none') return list.includes('none') ? [] : ['none'];
  const withoutNone = list.filter((item) => item !== 'none');
  return withoutNone.includes(value)
    ? withoutNone.filter((item) => item !== value)
    : [...withoutNone, value];
}

export default function Onboarding() {
  const navigate = useNavigate();
  const toast = useToast();
  const { markOnboardingCompleted } = useAuth();
  const reduceMotion = useReducedMotion();
  const [{ step, direction }, setPosition] = useState({ step: 0, direction: 1 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cardRef = useRef(null);
  const headingRef = useRef(null);
  const hasMoved = useRef(false);
  
  const {
    clearErrors,
    control,
    getValues,
    setError,
    setValue,
    trigger,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(onboardingSchema),
    defaultValues: INITIAL_LIFESTYLE_VALUES,
  });
  
  const values = useWatch({ control });

  // After a step change, bring the card into view and move focus to its heading.
  useEffect(() => {
    if (!hasMoved.current) {
      hasMoved.current = true;
      return;
    }
    cardRef.current?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
    headingRef.current?.focus({ preventScroll: true });
  }, [step, reduceMotion]);

  const setField = (field, value) => {
    setValue(field, value, { shouldDirty: true });
    clearErrors(field);
  };

  const goTo = (nextStep) =>
    setPosition(({ step: from }) => ({ step: nextStep, direction: nextStep > from ? 1 : -1 }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!(await trigger(STEP_FIELDS[step], { shouldFocus: true }))) return;
    if (step < TOTAL_STEPS - 1) {
      goTo(step + 1);
      return;
    }
    setIsSubmitting(true);
    try {
      await submitOnboarding(buildOnboardingPayload(getValues()));
      markOnboardingCompleted();
      toast('Your answers are saved.', 'success');
      navigate('/recommendations');
    } catch (error) {
      if (error.apiError?.code === 'CONSENT_REQUIRED') {
        setError('consent', { type: 'server', message: 'Please agree to continue.' });
        goTo(0);
      } else toast(getApiError(error), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const variants = {
    enter: (dir) => ({ opacity: 0, x: reduceMotion ? 0 : dir * 36 }),
    center: { opacity: 1, x: 0 },
    exit: (dir) => ({ opacity: 0, x: reduceMotion ? 0 : dir * -36 }),
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 top-16 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100/80 via-[#f8f7f1] to-[#f8f7f1] dark:from-emerald-950/50 dark:via-slate-950 dark:to-slate-950" aria-hidden="true" />
      
      <div className="relative z-10 mx-auto w-full max-w-2xl font-sans">
        <header className="mb-5">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Tell us about your routine
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            A few quick questions help us suggest blood tests worth discussing with your doctor.
          </p>
        </header>

        <div ref={cardRef} className="scroll-mt-20">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900">
            <form onSubmit={handleSubmit} noValidate>
              <div className="p-4 sm:p-6">
                <OnboardingProgress step={step} total={TOTAL_STEPS} title={STEP_TITLES[step]} />
              </div>

              <div className="overflow-x-clip px-4 pb-6 sm:px-6">
                <AnimatePresence mode="wait" custom={direction} initial={false}>
                  <motion.div
                    key={step}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: reduceMotion ? 0.15 : 0.26, ease: 'easeOut' }}
                    className="space-y-6"
                  >
                    <h2
                      ref={headingRef}
                      tabIndex={-1}
                      className="text-xl font-semibold text-slate-900 outline-none dark:text-white"
                    >
                      {STEP_TITLES[step]}
                    </h2>
                    
                    {step === 0 && (
                      <ConsentCheckbox
                        checked={values.consent}
                        onChange={(v) => setField('consent', v)}
                        error={errors.consent?.message}
                      />
                    )}
                    
                    {step === 1 && (
                      <>
                        <ChoiceGrid
                          legend="What is your diet type?"
                          name="dietType"
                          options={DIET_OPTIONS}
                          value={values.dietType}
                          onChange={(v) => setField('dietType', v)}
                          error={errors.dietType?.message}
                        />
                        <Stepper
                          legend="Meals per day"
                          unit="meals"
                          min={1}
                          max={10}
                          value={values.mealsPerDay}
                          onChange={(v) => setField('mealsPerDay', v)}
                        />
                        <ChipGroup
                          legend="What do you usually eat?"
                          hint="Pick any that apply."
                          options={TYPICAL_DIET_OPTIONS}
                          selected={values.typicalDiet}
                          onToggle={(v) =>
                            setField(
                              'typicalDiet',
                              values.typicalDiet.includes(v)
                                ? values.typicalDiet.filter((i) => i !== v)
                                : [...values.typicalDiet, v],
                            )
                          }
                          error={errors.typicalDiet?.message}
                        />
                        <div>
                          <label htmlFor="daily-diet-description" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">
                            What do you eat in a typical day?
                          </label>
                          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Include familiar staples and portions, for example: 2 rotis, 1 bowl dal, rice and sabzi.</p>
                          <textarea
                            id="daily-diet-description"
                            rows={3}
                            maxLength={600}
                            value={values.dailyDietDescription}
                            onChange={(event) => setField('dailyDietDescription', event.target.value)}
                            placeholder="Describe your usual meals and portions"
                            aria-describedby={errors.dailyDietDescription ? 'daily-diet-error' : undefined}
                            className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                          />
                          {errors.dailyDietDescription?.message && <p id="daily-diet-error" role="alert" className="mt-1 text-sm text-red-600">{errors.dailyDietDescription.message}</p>}
                        </div>
                      </>
                    )}
                    
                    {step === 2 && (
                      <>
                        <RangeField
                          legend="Hours of sleep"
                          unit="hrs"
                          min={3}
                          max={12}
                          step={0.5}
                          value={values.sleepHours}
                          onChange={(v) => setField('sleepHours', v)}
                        />
                        <ChoiceGrid
                          legend="When do you usually sleep?"
                          name="sleepTime"
                          options={SLEEP_TIME_OPTIONS}
                          value={values.sleepTime}
                          onChange={(v) => setField('sleepTime', v)}
                          error={errors.sleepTime?.message}
                        />
                        <ChoiceGrid
                          legend="How much sunlight do you get?"
                          name="sunExposure"
                          options={SUN_OPTIONS}
                          value={values.sunExposure}
                          onChange={(v) => setField('sunExposure', v)}
                          error={errors.sunExposure?.message}
                        />
                        <ChoiceGrid
                          legend="How active are you?"
                          name="activityLevel"
                          options={ACTIVITY_OPTIONS}
                          value={values.activityLevel}
                          onChange={(v) => setField('activityLevel', v)}
                          error={errors.activityLevel?.message}
                        />
                      </>
                    )}
                    
                    {step === 3 && (
                      <>
                        <ChipGroup
                          legend="Have you noticed any of these recently?"
                          options={SYMPTOM_OPTIONS}
                          selected={values.symptoms}
                          onToggle={(v) => setField('symptoms', toggleExclusive(values.symptoms, v))}
                          error={errors.symptoms?.message}
                        />
                        <ChipGroup
                          legend="Do you have any of these habits?"
                          options={HABIT_OPTIONS}
                          selected={values.habits}
                          onToggle={(v) => setField('habits', toggleExclusive(values.habits, v))}
                          error={errors.habits?.message}
                        />
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="sticky bottom-0 flex gap-3 border-t border-slate-100 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-6">
                {step > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1 sm:flex-none"
                    onClick={() => goTo(step - 1)}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                )}
                <Button
                  type="submit"
                  className="flex-1 sm:flex-none"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                >
                  {step === TOTAL_STEPS - 1 ? 'See my tests' : 'Next'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
