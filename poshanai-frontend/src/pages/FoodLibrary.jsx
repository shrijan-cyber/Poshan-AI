import { useEffect, useState } from 'react';
import { AlertCircle, Apple, Bean, ChevronDown, ChevronUp, Citrus, Droplets, Leaf, LoaderCircle, RotateCw, Search, Sprout, Wheat, X } from 'lucide-react';
import { getApiError } from '../api/client.js';
import { searchFoods } from '../api/foodLogApi.js';
import NutrientModal from '../components/library/NutrientModal.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import { nutrientDetails } from '../data/nutrientDetails.js';

const nutrientIcons = {
  Protein: Bean,
  Grains: Wheat,
  Micronutrients: Citrus,
  Vegetables: Leaf,
  Fruits: Apple,
  'Diet & Calcium': Droplets,
  'Healthy Fats': Sprout,
};

const nutrientRows = [
  ['Calories', 'calories', 'kcal'],
  ['Protein', 'protein', 'g'],
  ['Carbohydrate', 'carbs', 'g'],
  ['Fat', 'fat', 'g'],
];
const micronutrientRows = [
  ['Iron', 'iron'],
  ['Calcium', 'calcium'],
  ['Vitamin D', 'vitaminD'],
  ['Vitamin B12', 'vitaminB12'],
  ['Fiber', 'fiber'],
];

const formatNutrient = (value, unit) => value === null || value === undefined || !Number.isFinite(Number(value))
  ? 'Unavailable'
  : `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`;

function FoodResult({ food, expanded, onToggle }) {
  const nutrients = food.nutrients ?? {};
  const renderNutrient = ([label, key]) => {
    const value = nutrients[key];
    const metadata = food.nutrientMetadata?.[key];
    const hasValue = value !== null && value !== undefined && Number.isFinite(Number(value));
    const unitLabel = metadata?.unit && metadata.unitMappingStatus !== 'unverified' ? ` ${metadata.unit}` : '';
    return (
      <div key={key} className="rounded-xl bg-paper p-3 dark:bg-slate-800">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label} / 100 g</p>
        <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
          {hasValue ? `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}${unitLabel}` : 'Unavailable'}
        </p>
        {hasValue && metadata?.unitMappingStatus === 'unverified' && <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">Unit mapping under review</p>}
      </div>
    );
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-forest/10 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-h-16 w-full items-center justify-between gap-4 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-forest sm:p-5"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold text-slate-900 dark:text-white">{food.foodName}</span>
          <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">{food.category || 'Food category unavailable'}</span>
        </span>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage/70 text-forest dark:bg-emerald-950 dark:text-emerald-200">
          {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        </span>
        <span className="sr-only">{expanded ? 'Hide' : 'Show'} food details for {food.foodName}</span>
      </button>
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-5 pt-4 dark:border-slate-800 sm:px-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {nutrientRows.map(([label, key, unit]) => (
              <div key={key} className="rounded-xl bg-paper p-3 dark:bg-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label} / 100 g</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{formatNutrient(nutrients[key], unit)}</p>
              </div>
            ))}
          </div>
          <h3 className="mt-5 text-sm font-semibold text-slate-800 dark:text-slate-100">Additional catalog nutrients</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{micronutrientRows.map(renderNutrient)}</div>
          <p className="mt-3 text-xs leading-5 text-amber-800 dark:text-amber-200">IFCT source-unit mapping and record-level source matching are not verified in this application subset. Values marked unavailable are missing in the catalog. Serving conversions and raw/cooked state are shown only when recorded; no conversion is inferred here.</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="font-medium text-slate-700 dark:text-slate-200">Preparation state</dt><dd className="mt-1 text-slate-600 dark:text-slate-400">{food.foodState || 'Not recorded for this food entry.'}</dd></div>
            <div><dt className="font-medium text-slate-700 dark:text-slate-200">Source and verification</dt><dd className="mt-1 text-slate-600 dark:text-slate-400">{food.source?.name || 'Source unavailable'}{food.source?.version ? ` · ${food.source.version}` : ''}. {food.source?.recordLevelMappingAvailable === false ? 'Dataset-level reference only; this food is not mapped to a verified source row.' : ''} {food.source?.reusePermission ? `Reuse status: ${food.source.reusePermission}` : ''}</dd></div>
          </dl>
          {food.servingUnits && Object.keys(food.servingUnits).length > 0 && (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Available logging measures: {Object.keys(food.servingUnits).join(', ')}.</p>
          )}
        </div>
      )}
    </article>
  );
}

export default function FoodLibrary() {
  const [selectedNutrient, setSelectedNutrient] = useState(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query.trim(), 350);
  const [foods, setFoods] = useState([]);
  const [category, setCategory] = useState('All categories');
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [expandedCode, setExpandedCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    if (debouncedQuery.length < 2) return undefined;

    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return null;
        setLoading(true);
        setError('');
        return searchFoods(debouncedQuery, {
          signal: controller.signal,
          page,
          limit: 6,
          category: category === 'All categories' ? undefined : category,
        });
      })
      .then((result) => {
        if (result === null) return;
        setFoods(Array.isArray(result.foods) ? result.foods : []);
        setPagination(result.pagination);
        setCategoryOptions(result.filters?.categories ?? []);
        setExpandedCode(null);
      })
      .catch((requestError) => {
        if (requestError.name !== 'CanceledError' && requestError.code !== 'ERR_CANCELED') {
          setFoods([]);
          setError(getApiError(requestError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, retryKey, page, category]);

  const visibleFoods = foods;
  const pageCount = pagination?.pages ?? 0;
  const showLoading = debouncedQuery.length >= 2 && loading;
  const entries = Object.entries(nutrientDetails);
  const [featuredName, featuredNutrient] = entries[0] ?? [];
  const FeaturedIcon = nutrientIcons[featuredName] ?? Leaf;

  return (
    <main className="min-h-[70vh] bg-paper px-4 py-8 dark:bg-slate-950 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <header className="grid gap-8 border-b border-forest/10 pb-9 dark:border-slate-800 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:pb-12">
          <div><p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">PoshanAI / Food library</p><h1 className="mt-4 max-w-2xl font-heading text-4xl leading-[1.08] tracking-tight text-slate-950 dark:text-white sm:text-6xl">Good food knowledge, for everyday plates.</h1></div>
          <p className="max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300 lg:justify-self-end">Search the IFCT food catalog for recorded calories and macros per 100 grams. Missing details stay clearly marked as unavailable.</p>
        </header>

        <section aria-labelledby="food-search-title" className="mt-8 rounded-3xl border border-forest/10 bg-white p-5 shadow-sm sm:p-7 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl"><h2 id="food-search-title" className="font-heading text-2xl text-slate-900 dark:text-white">Search foods</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Enter at least two letters. Search results come from the existing food catalog.</p></div>
            <div className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:max-w-2xl">
              <label className="relative block">
                <span className="sr-only">Search the food catalog</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} type="search" maxLength={60} placeholder="Try rice, wheat, egg…" className="min-h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-11 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-forest focus:ring-2 focus:ring-forest/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear food search" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest dark:hover:bg-slate-800"><X size={16} aria-hidden="true" /></button>}
              </label>
              <label className="sr-only" htmlFor="food-category">Filter food category</label>
              <select id="food-category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option>All categories</option>
                {categoryOptions.map((value) => <option key={value}>{value}</option>)}
              </select>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">Dietary labels and verified raw/cooked states are not present in this catalog. Results are searched and paginated by the server.</p>

          <div className="mt-5" aria-live="polite" aria-busy={showLoading}>
            {showLoading && <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-forest dark:text-emerald-200" role="status"><LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> Searching catalog…</div>}
            {!showLoading && debouncedQuery.length >= 2 && error && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 sm:flex-row sm:items-center sm:justify-between dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"><span className="flex items-center gap-2"><AlertCircle size={18} aria-hidden="true" />{error}</span><button type="button" onClick={() => setRetryKey((key) => key + 1)} className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg px-3 font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700"><RotateCw size={15} aria-hidden="true" /> Retry</button></div>}
            {!showLoading && !error && debouncedQuery.length < 2 && <p className="rounded-2xl bg-paper p-5 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">Start with a food name to see catalog records.</p>}
            {!showLoading && !error && debouncedQuery.length >= 2 && visibleFoods.length === 0 && <p className="rounded-2xl bg-paper p-5 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">No matching catalog foods found. Try a shorter or different search.</p>}
            {!showLoading && !error && visibleFoods.length > 0 && <div className="grid gap-3 md:grid-cols-2">{visibleFoods.map((food) => <FoodResult key={food.ifctCode} food={food} expanded={expandedCode === food.ifctCode} onToggle={() => setExpandedCode((current) => current === food.ifctCode ? null : food.ifctCode)} />)}</div>}
          </div>
          {pageCount > 1 && <nav aria-label="Food search result pages" className="mt-4 flex items-center justify-between gap-3"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest dark:border-slate-700 dark:text-white">Previous</button><span className="text-sm text-slate-600 dark:text-slate-300">Page {pagination.page} of {pageCount} · {pagination.total} foods</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest dark:border-slate-700 dark:text-white">Next</button></nav>}
        </section>

        {featuredNutrient && <section aria-label="Featured nutrition topic" className="my-12 grid overflow-hidden rounded-[1.75rem] bg-forest text-white shadow-lg md:grid-cols-[0.75fr_1.25fr] dark:bg-[#143b2c]">
          <div className="flex min-h-56 items-end justify-between bg-[#214f3d] p-6 sm:p-8 dark:bg-emerald-950/50"><span className="text-sm text-white/70">A place to begin</span><span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-sage"><FeaturedIcon size={30} aria-hidden="true" /></span></div>
          <div className="flex flex-col items-start justify-center p-6 sm:p-9"><p className="text-sm font-medium text-sage">{featuredName}</p><h2 className="mt-2 font-heading text-2xl font-semibold sm:text-3xl">{featuredNutrient.title ?? featuredName}</h2><p className="mt-3 max-w-xl leading-7 text-white/75">{featuredNutrient.subtitle}</p><button type="button" onClick={() => setSelectedNutrient(featuredNutrient)} className="mt-6 inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-forest transition hover:bg-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-forest">Explore this topic <span aria-hidden="true" className="ml-2">→</span></button></div>
        </section>}

        <section aria-labelledby="library-index-title" className="grid gap-7 lg:grid-cols-[minmax(13rem,0.6fr)_minmax(0,1.4fr)]">
          <div><h2 id="library-index-title" className="font-heading text-2xl text-slate-900 dark:text-white">Browse nutrition topics</h2><p className="mt-2 max-w-xs text-sm leading-6 text-slate-600 dark:text-slate-300">Choose a topic to explore its practical nutrition notes.</p></div>
          <div className="divide-y divide-forest/10 border-y border-forest/10 dark:divide-slate-800 dark:border-slate-800">
            {entries.map(([name, nutrient], index) => {
              const Icon = nutrientIcons[name] ?? Leaf;
              return <button key={name} type="button" onClick={() => setSelectedNutrient(nutrient)} className="group grid min-h-24 w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 py-4 text-left transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-forest dark:hover:bg-slate-900">
                <span className="text-xs tabular-nums text-slate-400">{String(index + 1).padStart(2, '0')}</span><span className="flex min-w-0 items-center gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sage/60 text-forest dark:bg-emerald-950 dark:text-emerald-200"><Icon size={20} aria-hidden="true" /></span><span className="min-w-0"><span className="block font-semibold text-slate-900 dark:text-white">{nutrient.title ?? name}</span><span className="mt-1 block truncate text-sm text-slate-500 dark:text-slate-400">{nutrient.subtitle}</span></span></span><span className="pr-3 text-lg text-forest transition-transform group-hover:translate-x-1 dark:text-emerald-300" aria-hidden="true">→</span>
              </button>;
            })}
          </div>
        </section>

        <p className="mx-auto mt-10 max-w-3xl text-center text-xs leading-5 text-slate-500 dark:text-slate-400">General nutrition information only. Nutrient needs vary by person; consult a qualified health professional for individual advice.</p>
      </div>

      <NutrientModal isOpen={Boolean(selectedNutrient)} nutrientData={selectedNutrient} onClose={() => setSelectedNutrient(null)} />
    </main>
  );
}
