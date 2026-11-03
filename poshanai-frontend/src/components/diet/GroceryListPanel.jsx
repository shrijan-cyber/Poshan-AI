import { useEffect, useState } from 'react';
import { Download, LoaderCircle, RefreshCw } from 'lucide-react';
import { getApiError } from '../../api/client.js';
import { groceryListToText, hasGroceryItems } from '../../utils/groceryListDownload.js';

function downloadTextFile(categories) {
  const file = new Blob([groceryListToText(categories)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'poshanai-grocery-list.txt';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function GroceryListPanel({ planId, fetchList }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(Boolean(planId));
  const [error, setError] = useState(!planId ? 'Grocery details are unavailable for this saved plan.' : '');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!planId || typeof fetchList !== 'function') return undefined;
    let active = true;
    fetchList(planId)
      .then((result) => { if (active) setCategories(Array.isArray(result) ? result : []); })
      .catch((requestError) => { if (active) setError(getApiError(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchList, planId, retryCount]);

  function retry() {
    setLoading(true);
    setError('');
    setRetryCount((count) => count + 1);
  }

  const hasItems = hasGroceryItems(categories);

  return (
    <section className="rounded-3xl border border-sage/80 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900" aria-labelledby="grocery-list-title" aria-busy={loading}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-forest dark:text-emerald-300">Practical next step</p>
          <h2 id="grocery-list-title" className="mt-1 font-heading text-xl font-semibold text-slate-900 dark:text-white">Grocery list</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Quantities come from the saved plan’s ingredients.</p>
        </div>
        {hasItems && (
          <button type="button" onClick={() => downloadTextFile(categories)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-deepForest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2">
            <Download size={16} aria-hidden="true" /> Download list
          </button>
        )}
      </div>

      {loading ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300" role="status"><LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> Loading saved grocery quantities…</p>
      ) : error ? (
        <div className="mt-5 flex flex-col items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">
          <p>{error}</p>
          <button type="button" onClick={retry} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-current px-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"><RefreshCw size={15} aria-hidden="true" /> Retry</button>
        </div>
      ) : !hasItems ? (
        <p className="mt-5 rounded-xl bg-sage/45 p-4 text-sm leading-6 text-slate-700 dark:bg-slate-800 dark:text-slate-300">This plan does not contain grocery quantities yet. Ingredient details may be limited for older saved plans.</p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((group) => {
            const items = (group.items ?? []).filter((item) => String(item?.foodName ?? item?.name ?? '').trim());
            if (!items.length) return null;
            return (
              <div key={group.category} className="rounded-xl bg-paper p-4 dark:bg-slate-800/70">
                <h3 className="text-sm font-semibold text-forest dark:text-emerald-200">{group.category || 'Other'}</h3>
                <ul className="mt-2 space-y-2">
                  {items.map((item, index) => (
                    <li key={`${item.foodName ?? item.name}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-slate-700 dark:text-slate-200">{item.foodName ?? item.name}</span>
                      <span className="shrink-0 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300">{item.quantityLabel ?? item.quantity ?? 'Quantity unavailable'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
