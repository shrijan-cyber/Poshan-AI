import { motion, useReducedMotion } from 'framer-motion';
import TiltCard from './TiltCard.jsx';

const cards = [
  {
    eyebrow: '01 / ROOTED IN CULTURE',
    title: 'Rooted in Indian Food',
    text: 'Nutrition guidance built around the meals, ingredients, and traditions already on your table.',
    image:
      'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=1400&q=85',
    alt: 'A traditional Indian thali with a variety of dishes',
    note: 'Everyday ingredients, made clearer',
  },
  {
    eyebrow: '02 / AI-POWERED ANALYSIS',
    title: 'Clarity from Data',
    text: 'Upload a blood report and review its extracted results for nutrients like iron, B12, and vitamin D, ready to discuss with a health professional.',
    image:
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1400&q=85',
    alt: 'Healthcare professional reviewing a medical report',
    note: 'Your information stays yours',
  },
  {
    eyebrow: '03 / MADE FOR YOU',
    title: 'Personalized Plans',
    text: 'Get practical meal plans shaped around your daily routine, food preferences, and health goals.',
    image:
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1400&q=85',
    alt: 'A colorful balanced meal with fresh vegetables',
    note: 'Small steps, at your pace',
  },
  {
    eyebrow: '04 / EXPERT GUIDANCE',
    title: 'Connect with Experts',
    text: 'Browse listed nutrition and health professionals and request guidance directly from the platform.',
    image:
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=1400&q=85',
    alt: 'A healthcare professional ready to offer guidance',
    note: 'Support when you need it',
  },
];

const entrances = [
  { opacity: 0, y: 36 },
  { opacity: 0, x: 36 },
  { opacity: 0, x: -36 },
  { opacity: 0, x: 36 },
];

export default function StickyCards() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="benefits"
      className="help-cards-clean bg-[#F9FBF9] px-5 py-16 font-sans text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:px-8 sm:py-20 lg:px-12 lg:py-24"
      aria-labelledby="sticky-features-title"
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 max-w-3xl sm:mb-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">
            How PoshanAI helps
          </p>
          <h2
            id="sticky-features-title"
            className="mt-3 font-sans text-3xl font-bold leading-tight tracking-tight text-[#1E5631] dark:text-emerald-200 sm:text-4xl lg:text-5xl"
          >
            Better choices, built from what you know.
          </h2>
        </header>

        <div className="grid gap-7 lg:gap-9">
          {cards.map((card, index) => {
            const isReversed = index % 2 === 1;
            const entrance = prefersReducedMotion ? { opacity: 1 } : entrances[index];

            return (
              <motion.div
                key={card.title}
                initial={entrance}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.65, ease: [0.22, 1, 0.36, 1] }
                }
              >
                <TiltCard
                  title={card.title}
                  badgeLabel={`0${index + 1}`}
                  className="help-clean-card min-h-0 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                >
                  <article className="relative grid min-h-0 overflow-hidden rounded-xl md:grid-cols-2">
                    <div
                      className={`relative order-1 flex min-w-0 min-h-[17rem] flex-col justify-center overflow-hidden p-7 sm:min-h-[20rem] sm:p-10 lg:p-14 ${
                        isReversed ? 'order-1 md:order-2' : 'order-1'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-2 -top-12 z-0 select-none font-sans text-[9rem] font-bold leading-none text-emerald-900/[0.08] sm:text-[12rem]"
                      >
                        0{index + 1}
                      </span>
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-7 left-0 z-10 w-1.5 rounded-r-full bg-[#F57C00] sm:inset-y-10"
                      />
                      <div className="relative z-10 [transform:translateZ(28px)]">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-700">
                          {card.eyebrow}
                        </p>
                        <h3 className="mt-4 max-w-xl font-sans text-3xl font-bold leading-tight text-[#1E5631] dark:text-emerald-200 sm:text-4xl lg:text-5xl">
                          {card.title}
                        </h3>
                        <p className="mt-4 max-w-lg text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
                          {card.text}
                        </p>
                        <p className="mt-5 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                          {card.note}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`order-2 min-w-0 min-h-[15rem] p-4 sm:min-h-[18rem] sm:p-5 ${
                        isReversed ? 'md:order-1' : ''
                      }`}
                    >
                      <motion.div
                        whileHover={prefersReducedMotion ? undefined : { scale: 1.025, z: 18 }}
                        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                        className="help-card-image h-full min-h-[14rem] overflow-hidden rounded-xl bg-[#E8EDDF] sm:min-h-[17rem]"
                      >
                        <img
                          src={card.image}
                          alt={card.alt}
                          loading="lazy"
                          decoding="async"
                          className="h-full min-h-[14rem] w-full rounded-xl object-cover sm:min-h-[17rem]"
                        />
                      </motion.div>
                    </div>
                  </article>
                </TiltCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
