import { useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';

const stats = [
  {
    value: 57.2,
    format: (value) => `${Math.min(value, 57.2).toFixed(1)}%`,
    title: 'of non-pregnant women aged 15–49 were anaemic',
    context: 'India · NFHS-5, 2019–21',
    source: 'NFHS-5 data',
    href: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=1795421&lang=2&reg=48',
  },
  {
    value: 1,
    format: (progress) => `${Math.round(progress * 70)}–${Math.round(progress * 90)}%`,
    title: 'vitamin D deficiency reported across studies in India',
    context: 'Range in a 2017 systematic review; estimates vary by study',
    source: 'Read the review',
    href: 'https://pubmed.ncbi.nlm.nih.gov/30090772/',
  },
  {
    value: 542,
    format: (value) => `${Math.round(Math.min(value, 542))}`,
    title: 'IFCT-derived food records in PoshanAI’s current dataset',
    context: 'Nutrition reference: Indian Food Composition Tables 2017',
    source: 'ICMR–NIN IFCT 2017',
    href: 'https://www.nin.res.in/ebooks/IFCT2017.pdf',
  },
  {
    value: 2017,
    format: (value) => `${Math.round(Math.min(value, 2017))}`,
    title: 'edition of India’s food composition reference',
    context: 'Indian Food Composition Tables · ICMR–National Institute of Nutrition',
    source: 'Explore IFCT 2017',
    href: 'https://www.nin.res.in/ebooks/IFCT2017.pdf',
  },
];

function CountUp({ value, format, delay = 0 }) {
  const ref = useRef(null);
  const progress = useMotionValue(0);
  const display = useTransform(progress, format);
  const inView = useInView(ref, { once: true, amount: 0.7 });
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!inView) return undefined;

    const controls = animate(progress, value, {
      duration: prefersReducedMotion ? 0 : 1.45,
      delay: prefersReducedMotion ? 0 : delay,
      ease: [0.16, 1, 0.3, 1],
    });

    return () => controls.stop();
  }, [delay, inView, prefersReducedMotion, progress, value]);

  return (
    <span ref={ref} className="block text-5xl font-semibold tracking-[-0.055em] text-white tabular-nums sm:text-6xl lg:text-7xl">
      <motion.span aria-hidden="true">{display}</motion.span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

export default function WhyPoshanAI() {
  return (
    <section
      id="why-poshanai"
      className="bg-[#1E5631] px-5 py-20 font-sans text-white sm:px-8 sm:py-24 lg:px-12 lg:py-28"
      aria-labelledby="why-poshanai-title"
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-12 max-w-2xl sm:mb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Why PoshanAI</p>
          <h2 id="why-poshanai-title" className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Better context for everyday food choices.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-emerald-50/80 sm:text-lg">
            Grounded in Indian food data and shaped around the questions people bring to their nutrition.
          </p>
        </header>

        <dl className="grid gap-0 border-t border-white/20 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={stat.title} className={`flex min-h-64 flex-col border-b border-white/20 py-8 xl:min-h-72 xl:border-b-0 xl:py-10 ${index > 0 ? 'xl:border-l xl:border-white/20 xl:pl-6 2xl:pl-9' : 'xl:pr-6 2xl:pr-9'}`}>
              <CountUp value={stat.value} format={stat.format} delay={index * 0.12} />
              <dt className="mt-5 max-w-xs text-lg font-medium leading-6 text-white sm:text-xl">{stat.title}</dt>
              <dd className="mt-3 text-sm leading-6 text-emerald-100/75">{stat.context}</dd>
              <dd className="mt-auto pt-6">
                <a
                  href={stat.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit text-sm font-medium text-white underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {stat.source}<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-6 max-w-4xl text-xs leading-5 text-emerald-100/70">
          Population findings provide context, not a personal diagnosis. The vitamin D range summarizes studies in a 2017 review and is not a current national estimate. PoshanAI’s count refers to records in its current dataset.
        </p>
      </div>
    </section>
  );
}
