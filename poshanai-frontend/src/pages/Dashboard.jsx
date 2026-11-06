import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarDays, ClipboardCheck, Salad } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Skeleton } from '../components/common/index.js';
import { useAuth } from '../hooks/useAuth.js';
import { useCachedFetch } from '../hooks/useCachedFetch.js';
import { getReport, getReportsPage, reviewReport } from '../api/reportApi.js'; // Added for Report Review
import CalorieTracker from '../components/dashboard/CalorieTracker.jsx';
import { generateMealPlan } from '../api/mealPlanApi.js';

const REPORTS_URL = '/reports?page=1&limit=50';
const MEAL_PLANS_URL = '/diet-plans';
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
});

function getReports(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.reports)) return data.reports;
  return null;
}

function getMealPlans(data) {
  if (Array.isArray(data?.mealPlans)) return data.mealPlans;
  if (Array.isArray(data?.plans)) return data.plans;
  if (Array.isArray(data)) return data;
  return null;
}

function getRecommendations(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.recommendations)) return data.recommendations;
  return null;
}

function getId(item) {
  const id = item?.id ?? item?._id;
  return typeof id === 'string' ? id : null;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : dateFormatter.format(date);
}

function RequestError({ title, message, onRetry }) {
  return (
    <Card className="dashboard-modern-card border-red-200 dark:border-red-900">
      <h3 className="font-semibold text-red-800 dark:text-red-300">{title}</h3>
      <p className="mt-2 text-sm text-red-700 dark:text-red-200">{message}</p>
      <Button className="mt-4" size="sm" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </Card>
  );
}

function retryRequest(refetch) {
  refetch().catch(() => {});
}

function ProfileSummary({ user }) {
  const profile = user?.profile ?? {};
  const fields = [
    ['Age', profile.age], ['Gender', profile.gender], ['Height', profile.heightCm],
    ['Weight', profile.weightKg], ['Diet', profile.dietType], ['Activity', profile.activityLevel],
    ['Region', profile.region],
  ];
  const completed = fields.filter(([, value]) => value !== undefined && value !== null && value !== '').length;
  const completion = Math.round((completed / fields.length) * 100);

  return (
    <Card as="section" aria-labelledby="profile-summary-title" className="h-full p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="profile-summary-title" className="font-heading text-xl text-slate-900 dark:text-white">
            Your profile
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {user?.onboardingCompleted ? 'Your lifestyle profile is saved.' : 'Add a few details to personalize your workspace.'}
          </p>
        </div>
        <Link
          to="/profile"
          aria-label="Edit your profile"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 text-forest transition hover:bg-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest dark:border-slate-700 dark:text-emerald-200 dark:hover:bg-slate-800"
        >
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Profile details</p>
        <p className="text-sm tabular-nums text-slate-500 dark:text-slate-400">{completed} of {fields.length}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-sage dark:bg-slate-800" role="progressbar" aria-label="Profile details completed" aria-valuemin="0" aria-valuemax={fields.length} aria-valuenow={completed}>
        <div className="h-full rounded-full bg-forest transition-[width] duration-500 dark:bg-emerald-400" style={{ width: `${completion}%` }} />
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3">
        {fields.slice(0, 4).map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="mt-0.5 truncate text-sm font-medium capitalize text-slate-800 dark:text-slate-100">
              {value ?? 'Not added'}{label === 'Height' && value != null ? ' cm' : ''}{label === 'Weight' && value != null ? ' kg' : ''}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function ReportList({ reports, isLoading, error, onRetry, hasMore, loadMore }) {
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(5);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState('');
  const handleLoadMore = async () => {
    if (visibleCount < reports.length) {
      setVisibleCount((count) => count + 5);
      return;
    }
    if (!hasMore || !loadMore) return;
    setLoadingMore(true);
    setLoadMoreError('');
    try { await loadMore(); setVisibleCount((count) => count + 5); }
    catch { setLoadMoreError('More reports could not be loaded. Please try again.'); }
    finally { setLoadingMore(false); }
  };

  return (
    <Card as="section" aria-labelledby="recent-reports-title" className="dashboard-modern-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="recent-reports-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            Recent reports
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Your five most recent uploaded reports.
          </p>
        </div>
        <Link
          to="/upload"
          className="text-sm font-semibold text-leaf underline decoration-emerald-300 underline-offset-4 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
        >
          Upload report
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-5 space-y-3" role="status" aria-label="Loading recent reports">
          {[0, 1, 2].map((item) => (
            <div key={item} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
              <Skeleton width="third" height="5" />
              <Skeleton className="mt-3" width="half" height="4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-5">
          <RequestError
            title="Reports could not be loaded"
            message={error.message || 'Please check your connection and try again.'}
            onRetry={onRetry}
          />
        </div>
      ) : reports === null ? (
        <p className="mt-5 text-sm text-red-700 dark:text-red-300" role="alert">
          The reports service returned data in an unexpected format.
        </p>
      ) : reports.length === 0 ? (
        <div className="mt-5 rounded-xl bg-cream p-5 dark:bg-slate-800">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            No reports yet. Upload your first blood report.
          </p>
          <Button className="mt-4" size="sm" onClick={() => navigate('/upload')}>
            Upload a report
          </Button>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
          {reports.slice(0, visibleCount).map((report, index) => {
            const id = getId(report);
            const status = report.ocrStatus || 'status unavailable';
            return (
              <li key={id || `${report.uploadedAt || 'report'}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    Blood report · {formatDate(report.uploadedAt)}
                  </p>
                  <p className="mt-1 text-sm capitalize text-slate-500 dark:text-slate-400">
                    Processing status: {status}
                  </p>
                </div>
                {id && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Report ID: {id.slice(-6)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!isLoading && !error && reports?.length > 0 && (visibleCount < reports.length || hasMore) && <button type="button" className="mt-5 rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-leaf hover:bg-emerald-50 disabled:opacity-50" onClick={handleLoadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more reports'}</button>}
      {loadMoreError && <p role="alert" className="mt-2 text-sm text-red-700">{loadMoreError}</p>}
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [additionalReports, setAdditionalReports] = useState([]);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsHasMore, setReportsHasMore] = useState(false);
  const {
    data: reportData,
    isLoading: reportsLoading,
    error: reportsError,
    refetch: refetchReports,
  } = useCachedFetch(REPORTS_URL);
  const {
    data: mealPlanData,
    isLoading: mealPlansLoading,
    error: mealPlansError,
    refetch: refetchMealPlans,
  } = useCachedFetch(MEAL_PLANS_URL);
  const {
    data: recommendationData,
    isLoading: recommendationsLoading,
    error: recommendationsError,
    refetch: refetchRecommendations,
  } = useCachedFetch('/lifestyle/recommendations');

  const firstPageReports = getReports(reportData);
  const reports = firstPageReports === null ? null : [...firstPageReports, ...additionalReports];
  const mealPlans = getMealPlans(mealPlanData);
  const mealPlansFormatError = !mealPlansLoading && !mealPlansError && mealPlans === null;
  const activeMealPlans = mealPlans?.filter((plan) => plan.status === 'active') ?? [];
  const latestMealPlan = mealPlans?.[0] ?? null;
  const activeMealPlanId = activeMealPlans.map(getId).find(Boolean);
  const hasMoreMealPlans = (mealPlanData?.pagination?.pages ?? 1) > 1;
  const recommendations = getRecommendations(recommendationData);
  const recommendationsStatus = recommendationData?.recommendationStatus;

  // --- State for Report Review (from Member 2) ---
  const [selectedReport, setSelectedReport] = useState(null);
  const [reviewError, setReviewError] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const handleOpenReport = async (report) => {
    try {
      const data = await getReport(report.id ?? report._id);
      setSelectedReport(data.report ?? data);
    } catch {
      setReviewError('Could not load report values.');
    }
  };

  const loadMoreReports = async () => {
    const nextPage = reportsPage + 1;
    const result = await getReportsPage(nextPage, 50);
    setAdditionalReports((current) => [...current, ...result.reports]);
    setReportsPage(nextPage);
    setReportsHasMore(Boolean(result.pagination ? nextPage < result.pagination.totalPages : result.reports.length === 50));
  };

  const handleSubmitReview = async (reviewStatus) => {
    setSavingReview(true);
    try {
      const data = await reviewReport(selectedReport.id || selectedReport._id, reviewStatus, selectedReport.extractedValues);
      const reviewed = data.report ?? data;
      setSelectedReport(reviewed);
      refetchReports(); // Refresh list to show updated status
    } catch {
      setReviewError('Could not save report review.');
    } finally {
      setSavingReview(false);
    }
  };

  const handleGeneratePlan = async () => {
    const reportId = selectedReport?.id ?? selectedReport?._id;
    if (!reportId) return;
    setGeneratingPlan(true);
    setReviewError('');
    try {
      const response = await generateMealPlan({ reportId });
      const job = response?.data ?? response;
      if (!job?.jobId) throw new Error('The generation service did not return a job ID.');
      navigate(`/meal-plan/${encodeURIComponent(job.jobId)}`);
    } catch (error) {
      setReviewError(error.message || 'Could not start meal-plan generation.');
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleInputChange = (index, newValue) => {
    setSelectedReport((current) => ({
      ...current,
      extractedValues: current.extractedValues.map((item, itemIndex) =>
        itemIndex === index ? { ...item, value: Number(newValue) } : item
      ),
    }));
  };

  return (
    <motion.div
      className="dashboard-modern mx-auto max-w-[88rem] space-y-8 pb-8 sm:space-y-10"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <header className="grid gap-6 border-b border-forest/10 pb-7 dark:border-slate-700 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:pb-8">
        <div className="max-w-3xl">
          <h1 className="font-heading text-4xl leading-tight tracking-tight text-forest dark:text-white sm:text-5xl">
            Welcome back, {user?.name || 'there'}.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
            Your day, food log, reports, and plans are together here. Start with what you’ve eaten today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <div className="flex min-h-11 items-center gap-2 rounded-full border border-forest/10 bg-white/70 px-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <CalendarDays size={17} aria-hidden="true" />
            <time dateTime={new Date().toISOString().slice(0, 10)}>{formatDate(new Date())}</time>
          </div>
          <nav aria-label="Quick nutrition links" className="flex flex-wrap gap-2 sm:justify-end">
            <Button as={Link} to="/calorie-tracker" className="min-h-11">Food log <ArrowRight size={16} aria-hidden="true" /></Button>
            <Button as={Link} to="/food-library" variant="secondary" className="min-h-11">Food library</Button>
            <Button as={Link} to="/diet-plan" variant="secondary" className="min-h-11">Diet plan</Button>
          </nav>
        </div>
      </header>

      <section aria-label="Today’s nutrition and next steps" className="grid items-start gap-7 2xl:grid-cols-[minmax(0,1.7fr)_minmax(19rem,0.72fr)] 2xl:gap-9">
        <div className="min-w-0 rounded-[1.75rem] bg-white p-4 shadow-[0_14px_40px_rgba(23,58,44,0.06)] dark:bg-slate-900 sm:p-6">
          <CalorieTracker />
        </div>
        <aside className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-1" aria-label="Profile and plan">
          <ProfileSummary user={user} />
          <Card as="section" aria-labelledby="active-plan-title" className="h-full p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="active-plan-title" className="font-heading text-xl text-slate-900 dark:text-white">Meal plan</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Most recently saved</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-sage text-forest dark:bg-emerald-950 dark:text-emerald-200"><Salad size={19} aria-hidden="true" /></span>
            </div>
            {mealPlansLoading ? (
              <div className="mt-5 space-y-3" role="status" aria-label="Loading meal plan"><Skeleton height="5" width="half" /><Skeleton height="4" /></div>
            ) : mealPlansError || mealPlansFormatError ? (
              <div className="mt-5"><RequestError title="Meal plan unavailable" message={mealPlansError?.message || 'The meal-plans service returned an unexpected response.'} onRetry={() => retryRequest(refetchMealPlans)} /></div>
            ) : latestMealPlan ? (
              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-900 dark:text-white">{latestMealPlan.title || latestMealPlan.name || (latestMealPlan.type === 'basic' ? 'Basic diet plan' : 'Personalized meal plan')}</p>
                  <span className="rounded-full bg-sage px-3 py-1 text-xs font-semibold capitalize text-forest dark:bg-emerald-950 dark:text-emerald-200">{latestMealPlan.status || (latestMealPlan.type === 'basic' ? 'Saved' : 'Status unavailable')}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{hasMoreMealPlans ? 'This is your most recent plan. Other saved plans are available.' : 'Open it to review meals and portions.'}</p>
                <Button as={Link} to={latestMealPlan.type === 'basic' ? '/diet-plan/view' : getId(latestMealPlan) ? `/meal-plan/${encodeURIComponent(getId(latestMealPlan))}` : activeMealPlanId ? `/meal-plan/${encodeURIComponent(activeMealPlanId)}` : '/meal-plan'} variant="secondary" className="mt-5 w-full">Open meal plan <ArrowRight size={16} aria-hidden="true" /></Button>
              </div>
            ) : (
              <div className="mt-6">
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">No active plan is saved yet. Build a plan around your preferences.</p>
                <Button as={Link} to="/diet-plan" variant="secondary" className="mt-5 w-full">Build a diet plan <ArrowRight size={16} aria-hidden="true" /></Button>
              </div>
            )}
          </Card>
          <Card as="section" aria-labelledby="lifestyle-summary-title" className="h-full p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="lifestyle-summary-title" className="font-heading text-xl text-slate-900 dark:text-white">Lifestyle check-in</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Topics you may discuss with a qualified professional.</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-sage text-forest dark:bg-emerald-950 dark:text-emerald-200" aria-hidden="true">✓</span>
            </div>
            {recommendationsLoading ? (
              <div className="mt-5 space-y-3" role="status" aria-label="Loading lifestyle topics"><Skeleton height="5" width="half" /><Skeleton height="4" /></div>
            ) : recommendationsError ? (
              <div className="mt-5"><RequestError title="Lifestyle topics unavailable" message={recommendationsError.message || 'Please try again.'} onRetry={() => retryRequest(refetchRecommendations)} /></div>
            ) : recommendations === null ? (
              <p className="mt-5 text-sm text-slate-600 dark:text-slate-300">Your lifestyle topics could not be displayed.</p>
            ) : recommendationsStatus === 'needs_onboarding' ? (
              <div className="mt-5"><p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Complete your lifestyle profile to see relevant discussion topics.</p><Button as={Link} to="/onboarding" variant="secondary" className="mt-4 w-full">Complete check-in</Button></div>
            ) : recommendationsStatus === 'pending_clinical_review' ? (
              <p className="mt-5 text-sm leading-6 text-slate-600 dark:text-slate-300">Your answers are saved. Recommendation rules are waiting for clinical review, so no topics are shown yet.</p>
            ) : recommendations.length > 0 ? (
              <div className="mt-5 space-y-3">
                {recommendations.slice(0, 2).map((item) => <div key={item.ruleId ?? item.testName} className="rounded-xl bg-paper p-3 dark:bg-slate-800"><p className="text-sm font-semibold text-slate-900 dark:text-white">{item.testName || 'Health topic'}</p><p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">{item.rationale || item.reason || 'Discuss this topic with a healthcare professional.'}</p></div>)}
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Suggestions are not a diagnosis. A clinician can decide whether any assessment is appropriate.</p>
                <Button as={Link} to="/recommendations" variant="secondary" className="w-full">View all topics <ArrowRight size={16} aria-hidden="true" /></Button>
              </div>
            ) : (
              <div className="mt-5"><p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{recommendationData?.routineMessage || 'No specific discussion topics matched your saved answers. Ask your doctor about routine care that fits your health history.'}</p><Button as={Link} to="/recommendations" variant="secondary" className="mt-4 w-full">View check-in</Button></div>
            )}
          </Card>
        </aside>
      </section>

      <section aria-label="Reports and review" className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <ReportList reports={reports} isLoading={reportsLoading} error={reportsError} onRetry={() => retryRequest(refetchReports)} hasMore={reportsHasMore || (firstPageReports?.length === 50 && reportsPage === 1)} loadMore={loadMoreReports} />

        <details className="group rounded-2xl border border-forest/10 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6" open={Boolean(selectedReport)}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-sage text-forest dark:bg-emerald-950 dark:text-emerald-200"><ClipboardCheck size={19} aria-hidden="true" /></span>
              <span><span className="block font-heading text-xl text-slate-900 dark:text-white">Review a report</span><span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-300">Check extracted values before using them.</span></span>
            </span>
            <ArrowRight size={17} className="shrink-0 text-forest transition-transform group-open:rotate-90 dark:text-emerald-200" aria-hidden="true" />
          </summary>
          <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
            {reviewError && <p role="alert" className="mb-3 text-sm text-red-700 dark:text-red-300">{reviewError}</p>}
            {reports && reports.filter((report) => report.ocrStatus === 'completed').length > 0 ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {reports.filter((report) => report.ocrStatus === 'completed').map((report) => (
                  <li key={report.id ?? report._id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="text-sm text-slate-700 dark:text-slate-200">Report · {report.reviewStatus ?? 'pending review'}</span>
                    <Button size="sm" variant="secondary" onClick={() => handleOpenReport(report)}>Review values</Button>
                  </li>
                ))}
              </ul>
            ) : reportsLoading ? (
              <p className="text-sm text-slate-500" role="status">Loading completed reports…</p>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">No completed reports available for review.</p>
            )}

            {selectedReport && (
              <div className="mt-5 space-y-4 rounded-xl bg-paper p-4 dark:bg-slate-800">
                <h3 className="font-semibold text-slate-900 dark:text-white">Extracted values</h3>
                {selectedReport.extractedValues?.map((value, index) => (
                  <label key={`${value.nutrient}-${index}`} className="grid gap-1 text-sm text-slate-700 dark:text-slate-300">
                    {value.nutrient} ({value.unit ?? 'unit unavailable'})
                    <input type="number" step="any" value={value.value} onChange={(event) => handleInputChange(index, event.target.value)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
                  </label>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button disabled={savingReview} onClick={() => handleSubmitReview('confirmed')}>{savingReview ? 'Saving…' : 'Confirm values'}</Button>
                  <Button disabled={savingReview} variant="secondary" onClick={() => handleSubmitReview('corrected')}>Save corrections</Button>
                  {(selectedReport.reviewStatus === 'confirmed' || selectedReport.reviewStatus === 'corrected') && <Button disabled={generatingPlan} variant="secondary" onClick={handleGeneratePlan}>{generatingPlan ? 'Starting…' : 'Generate meal plan'}</Button>}
                </div>
              </div>
            )}
          </div>
        </details>
      </section>

      <nav aria-label="More nutrition tools" className="flex flex-col gap-4 border-y border-forest/10 py-6 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl text-slate-900 dark:text-white">Continue with PoshanAI</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Choose a next step when you’re ready.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button as={Link} to="/upload" variant="secondary">Upload report <ArrowRight size={15} aria-hidden="true" /></Button>
          <Button as={Link} to="/food-library" variant="secondary">Explore food library <ArrowRight size={15} aria-hidden="true" /></Button>
          <Button as={Link} to="/recommendations" variant="secondary">Lifestyle check <ArrowRight size={15} aria-hidden="true" /></Button>
        </div>
      </nav>

      <p className="max-w-4xl text-xs leading-6 text-slate-500 dark:text-slate-400">
        PoshanAI provides nutrition awareness and food suggestions. It does not diagnose or replace advice from a qualified healthcare professional.
      </p>
    </motion.div>
  );
}
