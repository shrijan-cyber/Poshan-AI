import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '../common/index.js';
import TestIcon from './TestIcon.jsx';

function sourceLabel(source) {
  try {
    return new URL(source).hostname.replace(/^www\./, '');
  } catch {
    return 'Reference';
  }
}

export default function TestCard({ test, index, onWhyThis }) {
  const reduceMotion = useReducedMotion();
  const rationale = test.rationale ?? test.reason ?? 'Discuss whether this test is appropriate with your doctor.';
  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.07, ease: 'easeOut' }}
    >
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <TestIcon testName={test.testName} />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{test.testName}</h2>
            <p className="mt-1 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{rationale}</p>
            {test.whatItMeasures && (
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                <span className="font-semibold">What this covers: </span>{test.whatItMeasures}
              </p>
            )}
            {test.triggeringFactors?.length > 0 && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Based on: {test.triggeringFactors.map((factor) => factor.label).join('; ')}
              </p>
            )}
            {test.sources?.length > 0 && (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold">Guidance: </span>
                {test.sources.map((source, sourceIndex) => (
                  <span key={source}>
                    {sourceIndex > 0 ? ', ' : ''}
                    <a
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-leaf focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf"
                    >
                      {sourceLabel(source)}
                    </a>
                  </span>
                ))}
              </div>
            )}
            <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              {test.disclaimer ?? 'This is not a diagnosis. Discuss any test with a qualified doctor.'}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:shrink-0">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => onWhyThis(test)}
            aria-label={`Why ${test.testName}?`}
          >
            Why this?
          </Button>
          <Link
            to="/upload"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-3 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-2 dark:border-slate-600 dark:text-white dark:hover:bg-slate-800"
          >
            Upload this report later
          </Link>
        </div>
      </div>
    </motion.li>
  );
}
