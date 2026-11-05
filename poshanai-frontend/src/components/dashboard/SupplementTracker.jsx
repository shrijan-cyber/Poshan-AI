import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Pencil, Pill, Plus, RotateCw, Trash2, X } from 'lucide-react';
import { getApiError } from '../../api/client.js';
import {
  createUserSupplement,
  deleteUserSupplement,
  getMySupplements,
  getSupplementHistory,
  updateUserSupplement,
} from '../../api/supplementApi.js';
import { Button, Card } from '../common/index.js';

const nutrients = [
  ['vitaminA', 'Vitamin A'], ['vitaminC', 'Vitamin C'], ['vitaminD', 'Vitamin D'],
  ['vitaminE', 'Vitamin E'], ['vitaminK', 'Vitamin K'], ['vitaminB1', 'Vitamin B1'],
  ['vitaminB2', 'Vitamin B2'], ['vitaminB3', 'Vitamin B3'], ['vitaminB6', 'Vitamin B6'],
  ['vitaminB9', 'Folate'], ['vitaminB12', 'Vitamin B12'], ['iron', 'Iron'], ['calcium', 'Calcium'],
  ['zinc', 'Zinc'], ['magnesium', 'Magnesium'], ['potassium', 'Potassium'],
];
const units = {
  vitaminA: ['µg', 'mcg', 'µg RAE', 'mcg RAE', 'IU'], vitaminC: ['mg'], vitaminD: ['IU', 'µg', 'mcg'], vitaminE: ['mg', 'IU'],
  vitaminK: ['µg', 'mcg'], vitaminB1: ['mg'], vitaminB2: ['mg'], vitaminB3: ['mg'], vitaminB6: ['mg'],
  vitaminB9: ['µg', 'mcg', 'µg DFE', 'mcg DFE'], vitaminB12: ['µg', 'mcg'], iron: ['mg'], calcium: ['mg'], zinc: ['mg'],
  magnesium: ['mg'], potassium: ['mg'],
};
const servingUnits = ['tablet', 'capsule', 'softgel', 'scoop', 'drop', 'ml', 'g', 'mg', 'µg', 'mcg', 'IU', 'piece', 'serving', 'other'];
const blankForm = () => ({
  name: '', brand: '', servingAmount: '1', servingUnit: 'tablet', dosageAmount: '', dosageUnit: 'tablet',
  schedule: '', notes: '', components: [{ nutrient: 'vitaminD', amount: '', unit: 'IU' }],
});
const display = (value) => value === null || value === undefined || value === '' ? '—' : value;

function toPayload(form) {
  const components = form.components.filter((item) => item.amount !== '')
    .map((item) => ({ nutrient: item.nutrient, amount: Number(item.amount), unit: item.unit }));
  return {
    name: form.name.trim(), brand: form.brand.trim(),
    servingSize: { amount: Number(form.servingAmount), unit: form.servingUnit },
    ...(form.dosageAmount !== '' ? { dosage: { amount: Number(form.dosageAmount), unit: form.dosageUnit } } : {}),
    components, schedule: form.schedule.trim(), notes: form.notes.trim(),
  };
}

function fromSupplement(supplement) {
  return {
    name: supplement.name ?? '', brand: supplement.brand ?? '',
    servingAmount: String(supplement.servingSize?.amount ?? 1),
    servingUnit: supplement.servingSize?.unit ?? 'serving',
    dosageAmount: supplement.dosage?.amount == null ? '' : String(supplement.dosage.amount),
    dosageUnit: supplement.dosage?.unit ?? 'serving', schedule: supplement.schedule ?? '', notes: supplement.notes ?? '',
    components: supplement.components?.length
      ? supplement.components.map((item) => ({ ...item, amount: String(item.amount) }))
      : [{ nutrient: 'vitaminD', amount: '', unit: 'IU' }],
  };
}

export default function SupplementTracker() {
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  const refresh = useCallback(async (signal) => {
    setLoadError('');
    try {
      const [saved, logged] = await Promise.all([
        getMySupplements({ signal }),
        getSupplementHistory({ limit: 20, signal }),
      ]);
      setItems(saved.supplements ?? []);
      setHistory(logged.entries ?? []);
    } catch (requestError) {
      if (!signal?.aborted) setLoadError(getApiError(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => refresh(controller.signal));
    return () => controller.abort();
  }, [refresh]);

  const updateComponent = (index, changes) => setForm((current) => ({
    ...current,
    components: current.components.map((component, itemIndex) => itemIndex === index
      ? { ...component, ...changes } : component),
  }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = toPayload(form);
      if (editingId) await updateUserSupplement(editingId, payload);
      else await createUserSupplement(payload);
      setEditingId(null);
      setForm(blankForm());
      await refresh();
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const edit = (supplement) => {
    setEditingId(supplement._id ?? supplement.id);
    setForm(fromSupplement(supplement));
    setError('');
    setExpanded(true);
  };

  const remove = async (id) => {
    setError('');
    try {
      await deleteUserSupplement(id);
      setItems((current) => current.filter((item) => (item._id ?? item.id) !== id));
      if (editingId === id) { setEditingId(null); setForm(blankForm()); }
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  };

  return (
    <Card as="section" aria-labelledby="supplement-tracker-title" className="bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-leaf dark:text-emerald-300">Personal records</p>
          <h2 id="supplement-tracker-title" className="mt-1 flex items-center gap-2 text-xl font-semibold text-slate-900 dark:text-white"><Pill size={20} aria-hidden="true" />Supplement tracker</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Save product details and review supplements logged in your daily history.</p>
        </div>
        <Button variant="secondary" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {expanded ? 'Close' : 'Manage supplements'}
        </Button>
      </div>

      {loadError && <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100"><span className="flex items-center gap-2"><AlertCircle size={16} />{loadError}</span><button type="button" onClick={() => refresh()} className="inline-flex min-h-10 items-center gap-2 px-2 underline"><RotateCw size={15} />Retry</button></div>}

      {expanded && <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit saved supplement' : 'Add a supplement'}</h3>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blankForm()); }} aria-label="Cancel editing" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest dark:hover:bg-slate-800"><X size={17} /></button>}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Supplement name<input required maxLength={120} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" /></label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Brand (optional)<input maxLength={120} value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" /></label>
              <QuantityField label="Serving size on label" amount={form.servingAmount} unit={form.servingUnit} units={servingUnits} onAmount={(value) => setForm((current) => ({ ...current, servingAmount: value }))} onUnit={(value) => setForm((current) => ({ ...current, servingUnit: value }))} required />
              <QuantityField label="Dose recorded (optional)" amount={form.dosageAmount} unit={form.dosageUnit} units={servingUnits} onAmount={(value) => setForm((current) => ({ ...current, dosageAmount: value }))} onUnit={(value) => setForm((current) => ({ ...current, dosageUnit: value }))} />
            </div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Schedule note (optional)<input maxLength={160} value={form.schedule} onChange={(event) => setForm((current) => ({ ...current, schedule: event.target.value }))} placeholder="As noted on my product label" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" /></label>
            <div><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Nutrient components from label</h4><button type="button" onClick={() => setForm((current) => ({ ...current, components: [...current.components, { nutrient: 'vitaminD', amount: '', unit: 'IU' }] }))} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-forest hover:bg-sage/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"><Plus size={15} />Add nutrient</button></div>
              <div className="mt-2 space-y-2">{form.components.map((component, index) => <div key={`${index}-${component.nutrient}`} className="grid grid-cols-[minmax(0,1fr)_5rem_5rem_auto] gap-2">
                <label className="sr-only" htmlFor={`supplement-nutrient-${index}`}>Nutrient</label><select id={`supplement-nutrient-${index}`} value={component.nutrient} onChange={(event) => { const nutrient = event.target.value; updateComponent(index, { nutrient, unit: units[nutrient][0] }); }} className="min-h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950">{nutrients.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
                <label className="sr-only" htmlFor={`supplement-amount-${index}`}>Amount</label><input id={`supplement-amount-${index}`} type="number" min="0" max="100000" step="any" value={component.amount} onChange={(event) => updateComponent(index, { amount: event.target.value })} placeholder="Amount" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
                <label className="sr-only" htmlFor={`supplement-unit-${index}`}>Unit</label><select id={`supplement-unit-${index}`} value={component.unit} onChange={(event) => updateComponent(index, { unit: event.target.value })} className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950">{units[component.nutrient].map((unit) => <option key={unit}>{unit}</option>)}</select>
                <button type="button" onClick={() => setForm((current) => ({ ...current, components: current.components.filter((_, itemIndex) => itemIndex !== index) }))} aria-label={`Remove ${component.nutrient} component`} className="grid h-11 w-10 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest dark:hover:bg-rose-950/40"><X size={16} /></button>
              </div>)}</div>
            </div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Notes (optional)<textarea rows="2" maxLength={1000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label>
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Record label information only. This tracker does not recommend supplements or dosages.</p>
            {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
            <Button type="submit" loading={saving} className="w-full">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Save supplement'}</Button>
          </form>

          <div><h3 className="font-semibold text-slate-900 dark:text-white">Saved supplements</h3>{loading ? <p role="status" className="mt-2 text-sm text-slate-500">Loading saved supplements…</p> : items.length === 0 ? <p className="mt-2 rounded-xl bg-paper p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">No saved supplements yet.</p> : <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">{items.map((item) => { const id = item._id ?? item.id; return <li key={id} className="flex items-start justify-between gap-3 py-3"><div className="min-w-0"><p className="font-medium text-slate-900 dark:text-white">{item.name} {item.brand && <span className="font-normal text-slate-500">· {item.brand}</span>}</p><p className="text-xs text-slate-500 dark:text-slate-400">Serving: {item.servingSize?.amount} {item.servingSize?.unit}{item.components?.length ? ` · ${item.components.length} nutrient label value${item.components.length === 1 ? '' : 's'}` : ''}</p></div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => edit(item)} aria-label={`Edit ${item.name}`} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest dark:hover:bg-slate-800"><Pencil size={16} /></button><button type="button" onClick={() => remove(id)} aria-label={`Delete ${item.name}`} className="grid h-10 w-10 place-items-center rounded-lg text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest dark:text-rose-300 dark:hover:bg-rose-950/40"><Trash2 size={16} /></button></div></li>; })}</ul>}</div>
        </div>
        <div><h3 className="font-semibold text-slate-900 dark:text-white">Supplement log history</h3>{history.length === 0 ? <p className="mt-2 rounded-xl bg-paper p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">No logged supplement history yet.</p> : <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">{history.map((entry) => <li key={entry._id} className="py-3"><p className="font-medium text-slate-900 dark:text-white">{entry.supplementName}</p><p className="text-xs text-slate-500 dark:text-slate-400">{entry.date} · {display(entry.dosage)} {display(entry.unit)}</p></li>)}</ul>}</div>
      </div>}
    </Card>
  );
}

function QuantityField({ label, amount, unit, units: allowedUnits, onAmount, onUnit, required = false }) {
  return <fieldset className="min-w-0"><legend className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</legend><div className="mt-1 flex gap-2"><input type="number" min="0.001" max="100000" step="any" value={amount} onChange={(event) => onAmount(event.target.value)} required={required} className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" /><select value={unit} onChange={(event) => onUnit(event.target.value)} className="min-h-11 w-28 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950">{allowedUnits.map((option) => <option key={option}>{option}</option>)}</select></div></fieldset>;
}
