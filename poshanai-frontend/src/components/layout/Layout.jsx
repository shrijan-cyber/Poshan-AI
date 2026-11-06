import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Activity, ArrowLeft, BookOpen, ClipboardList, Home, Menu, Moon, Salad, Sun, UserRound, Upload, Users, FlaskConical, X } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../common/Toast.jsx';
import Footer from './Footer.jsx';
import Navbar from './Navbar.jsx';
import logo from '../../assets/logo.svg';

const navGroups = [
  { label: 'Overview', links: [
    { to: '/dashboard', label: 'Dashboard', Icon: Home },
    { to: '/calorie-tracker', label: 'Food log', Icon: Activity },
  ] },
  { label: 'Nutrition planning', links: [
    { to: '/diet-plan', label: 'Diet plan', Icon: Salad },
    { to: '/meal-plan', label: 'Meal plans', Icon: ClipboardList },
    { to: '/food-library', label: 'Food library', Icon: BookOpen },
  ] },
  { label: 'Health workspace', links: [
    { to: '/upload', label: 'Reports', Icon: Upload },
    { to: '/recommendations', label: 'Tests to discuss', Icon: FlaskConical },
    { to: '/experts', label: 'Experts', Icon: Users },
  ] },
  { label: 'Account', links: [
    { to: '/profile', label: 'Profile', Icon: UserRound },
    { to: '/onboarding', label: 'Lifestyle profile', Icon: UserRound },
    { to: '/', label: 'Back to home', Icon: ArrowLeft },
  ] },
];

function AuthenticatedNavbar({ dark, menuOpen, onToggleTheme, onToggleMenu }) {
  const { logout, user } = useAuth();
  const toast = useToast();
  return (
    <header className="pa-app-header sticky top-0 z-30 border-b border-slate-200/80 bg-paper/95 dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex h-[4.25rem] max-w-[90rem] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMenu}
            type="button"
            className="pa-icon-button flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 shadow-sm hover:bg-sage/50 dark:border-slate-700 dark:text-slate-100 md:hidden"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
          </button>
          <Link to="/" aria-label="PoshanAI home" className="flex items-center gap-2 text-xl font-bold text-leaf dark:text-emerald-300">
            <img src={logo} alt="" className="h-9 w-9 rounded-full" />
            <span>Poshan<span className="text-moss">AI</span></span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden max-w-40 truncate text-sm font-medium text-slate-600 dark:text-slate-300 sm:inline">{user?.name || user?.email}</span>
          <button
            onClick={onToggleTheme}
            type="button"
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm shadow-sm hover:bg-sage/50 dark:border-slate-700 dark:hover:bg-slate-800"
            aria-label="Toggle dark mode"
          >
            {dark ? <><Sun size={16} aria-hidden="true" /> Light</> : <><Moon size={16} aria-hidden="true" /> Dark</>}
          </button>
          <button
            onClick={() =>
              logout().catch(() =>
                toast(
                  'Your local session ended, but the server session could not be cleared.',
                  'error',
                ),
              )
            }
            className="rounded-lg bg-forest px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-deepForest"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-cream text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <a className="pa-skip-link" href="#main-content">Skip to content</a>
      <Navbar />
      <div id="main-content" tabIndex="-1" className="pa-public-content flex-1"><Outlet /></div>
      <Footer />
    </div>
  );
}

export default function Layout({ children }) {
  const { isDark, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen bg-cream text-slate-800 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <a className="pa-skip-link" href="#main-content">Skip to content</a>
      <AuthenticatedNavbar
        dark={isDark}
        onToggleTheme={toggleTheme}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((value) => !value)}
      />
      <div className="pa-app-frame mx-auto flex max-w-[90rem]">
        <aside
          className={`${menuOpen ? 'block' : 'hidden'} pa-app-sidebar absolute z-20 min-h-[calc(100vh-4.25rem)] w-[17rem] border-r border-slate-200 bg-paper px-4 py-6 dark:border-slate-800 dark:bg-slate-950 md:relative md:block`}
        >
          <nav className="space-y-6" aria-label="Main navigation">
            {navGroups.map((group) => <section key={group.label} aria-label={group.label}>
              <h2 className="mb-2 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{group.label}</h2>
              <div className="space-y-1">
            {group.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `pa-nav-link flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${isActive ? 'border-emerald-100 bg-emerald-50 text-forest dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300' : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900'}`
                }
              >
                <link.Icon size={18} aria-hidden="true" />
                <span>{link.label}</span>
              </NavLink>
            ))}
              </div>
            </section>)}
          </nav>
        </aside>
        {menuOpen && <button type="button" className="pa-sidebar-backdrop fixed inset-x-0 bottom-0 top-[4.25rem] z-10 bg-ink/20 md:hidden" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
        <main id="main-content" tabIndex="-1" className="pa-app-main min-w-0 flex-1 px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
            >
              {children ?? <Outlet />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
