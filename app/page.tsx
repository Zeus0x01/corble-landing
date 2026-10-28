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
          <button className={`menu-btn${open ? ' open' : ''}`} aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen(!open)}>
            <span /><span /><span />
          </button>
        </div>
        <nav id="mobileMenu" className={`mobile-menu${open ? ' open' : ''}`} aria-label="Mobile">
          <a href="#platform" onClick={() => setOpen(false)}>Platform</a>
          <a href="#how" onClick={() => setOpen(false)}>How it works</a>
          <a href="#pricing" onClick={() => setOpen(false)}>Pricing</a>
          <a href="#customers" onClick={() => setOpen(false)}>Customers</a>
          <a href="/login">Client Portal</a>
          <a href="#contact" onClick={() => setOpen(false)}>Start Free →</a>
        </nav>
      </div>
    </header>
  );
}

export default function Page() {
  return (
    <>
      <Nav />
      <main style={{ padding: '40px 20px', maxWidth: 720, margin: '0 auto', color: '#f2f5f9' }}>
        <h1 style={{ fontSize: '2.4rem', letterSpacing: '-0.03em' }}>Corble landing page restore in progress</h1>
        <p style={{ color: '#9aa4b2' }}>The previous empty commit is being fixed. Full page + mobile tour auto-play and navbar isolation will be restored in the next commit. Workspace at /workspace is unaffected.</p>
        <p><a href="/workspace" style={{ color: '#c8ff00' }}>Open Workspace →</a></p>
      </main>
    </>
  );
}
