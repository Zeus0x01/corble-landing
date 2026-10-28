'use client';

import { useEffect, useRef, useState } from 'react';

const Logo = () => (
  <a className="brand" href="#home" aria-label="Corble home">
    <img src="/corble-logo-dark.png" alt="Corble" width="574" height="192" />
  </a>
);

function useNavFlight() {
  const [sky, setSky] = useState(false);
  const [away, setAway] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        setSky(y > 40);
        setAway(y > last && y > 220 && !document.getElementById('mobileMenu')?.classList.contains('open'));
        last = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return { sky, away };
}

const Check = () => <span aria-hidden="true" />;

function Nav() {
  const [open, setOpen] = useState(false);
  const { sky, away } = useNavFlight();
  const cls = `topbar${sky ? ' sky' : ''}${away ? ' away' : ''}`;
  return (
    <header className={cls} aria-label="Main navigation">
      <div className="container nav">
        <Logo />
        <nav className="nav-links" aria-label="Main">
          <a href="#platform">Platform</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#customers">Customers</a>
        </nav>
        <div className="nav-actions">
          <a className="btn btn-ghost" href="/login">Client Portal</a>
          <a className="btn btn-lime" href="#contact">Start Free <span aria-hidden="true">→</span></a>
          <button
            className={`menu-btn${open ? ' open' : ''}`}
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <span /><span /><span />
          </button>
        </div>
        <nav id="mobileMenu" className={`mobile-menu${open ? ' open' : ''}`} aria-label="Mobile">
          <a href="#platform">Platform</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#customers">Customers</a>
          <a href="/login">Client Portal</a>
          <a href="#contact">Start Free →</a>
        </nav>
      </div>
    </header>
  );
}

// NOTE: Full restored + fixed page content continues in next update if needed
export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <p style={{ padding: 40, color: '#fff' }}>Landing page is being restored. Please wait for the next commit.</p>
      </main>
    </>
  );
}
