import { useState } from 'react';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { Button } from '../common/index.js';
import logo from '../../assets/logo.svg';

const linkClass = ({ isActive }) => `flex min-h-11 items-center rounded-xl px-3 font-sans text-sm font-medium tracking-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf ${isActive ? 'bg-sage/70 text-forest dark:bg-emerald-950/50 dark:text-emerald-300' : 'text-slate-700 hover:bg-sage/40 hover:text-forest dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-300'}`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isLanding = pathname === '/';

  const closeMenu = () => setMenuOpen(false);
  const homeLinks = (
    <>
      <Link to={isLanding ? '#approach' : '/#approach'} onClick={closeMenu} className={linkClass({ isActive: false })}>Our approach</Link>
      <Link to={isLanding ? '#benefits' : '/#benefits'} onClick={closeMenu} className={linkClass({ isActive: false })}>Why PoshanAI</Link>
    </>
  );
  const themeButton = (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-sage/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
    >
      {isDark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
      <span className="sr-only">{isDark ? 'Light' : 'Dark'} theme</span>
    </button>
  );

  return (
    <header className="pa-app-header sticky top-0 z-30 border-b border-slate-200/80 bg-paper/95 dark:border-slate-800 dark:bg-slate-950/95">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" onClick={closeMenu} className="flex shrink-0 items-center gap-2" aria-label="PoshanAI home">
          <img src={logo} alt="" className="h-10 w-10 rounded-full object-cover" />
          <span className="text-lg font-bold tracking-tight text-forest dark:text-emerald-300">Poshan<span className="text-moss">AI</span></span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {homeLinks}
          <NavLink to="/food-library" className={linkClass}>Food library</NavLink>
        </nav>
        <div className="hidden items-center gap-1 md:flex">
          {themeButton}
          {user ? <>
            <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
            <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
          </> : <>
            <NavLink to="/login" className={linkClass}>Sign in</NavLink>
            <NavLink to="/register" className="flex min-h-11 items-center rounded-xl bg-forest px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-deepForest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-2">Create account</NavLink>
          </>}
        </div>
        <div className="flex items-center gap-1 md:hidden">
          {themeButton}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 text-lg text-forest shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf dark:border-slate-700 dark:text-emerald-200 dark:hover:bg-slate-800"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-main-navigation"
          >
            {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav id="mobile-main-navigation" className="absolute inset-x-0 top-full border-b border-slate-200 bg-white p-4 shadow-lg shadow-forest/10 dark:border-slate-800 dark:bg-slate-900 md:hidden" aria-label="Mobile navigation">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {homeLinks}
            <NavLink to="/food-library" onClick={closeMenu} className={linkClass}>Food library</NavLink>
            {user ? <>
              <NavLink to="/dashboard" onClick={closeMenu} className={linkClass}>Dashboard</NavLink>
              <Button variant="ghost" size="sm" onClick={() => { closeMenu(); logout(); }}>Sign out</Button>
            </> : <>
              <NavLink to="/login" onClick={closeMenu} className={linkClass}>Sign in</NavLink>
            <NavLink to="/register" onClick={closeMenu} className="mt-1 flex min-h-11 items-center justify-center rounded-xl bg-forest px-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-deepForest">Create account</NavLink>
            </>}
          </div>
        </nav>
      )}
    </header>
  );
}
