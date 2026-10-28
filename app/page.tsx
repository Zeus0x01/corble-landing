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

function Hero() {
  const bars = [28, 42, 35, 55, 48, 66, 58, 78, 70, 88, 82, 100];
  return (
    <section className="hero" id="home">
      <div className="aurora" style={{ width: '480px', height: '480px', top: '6%', left: '-90px' }} data-parallax="0.12" aria-hidden="true" />
      <div className="aurora" style={{ width: '380px', height: '380px', bottom: '4%', right: '-60px', animationDelay: '-8s' }} data-parallax="0.2" aria-hidden="true" />
      <div className="deco" style={{ top: '12%', left: '6%' }} data-parallax="0.16" aria-hidden="true"><div className="deco-cube" /></div>
      <div className="deco" style={{ bottom: '18%', left: '12%' }} data-parallax="0.3" aria-hidden="true"><div className="deco-cube" style={{ animationDelay: '2s' }} /></div>
      <div className="deco" style={{ top: '18%', right: '30%', width: '42px', height: '42px' }} data-parallax="0.24" aria-hidden="true"><div className="deco-ring" /></div>
      <div className="container hero-grid scene">
        <div>
          <span className="eyebrow"><span className="pulse-dot" />Live operations, handled</span>
          <h1>Decisions,<br />not <span className="shimmer">dashboards.</span></h1>
          <p className="lead">
            Corble builds practical websites and automation systems that capture leads,
            answer customers, and run the busywork — so you save hours every week and grow
            while you focus on real work.
          </p>
          <div className="hero-ctas">
            <a className="btn btn-lime" href="#contact">Start Free <span aria-hidden="true">→</span></a>
            <a className="btn btn-ghost" href="#how">Watch 2-min tour <span aria-hidden="true">▶</span></a>
          </div>
          <div className="hero-trust">
            <span><i />11 hrs saved / week</span>
            <span><i />40+ integrations</span>
            <span><i />SOC 2 ready</span>
          </div>
        </div>
        <div className="mockup-wrap">
          <div className="float-driver">
            <div className="mockup" data-tilt data-tilt-max="7" role="img" aria-label="Corble workspace dashboard preview showing live metrics and an AI draft">
              <div className="mock-card-under" aria-hidden="true" />
              <div className="mockup-head">
                <span className="mock-title"><span className="pulse-dot" />Workspace overview</span>
                <span>Last 30 days ⌄</span>
              </div>
              <div className="mock-cards">
                <div className="mock-metric"><small>New inquiries</small><strong>24</strong><em>↗ 20%</em></div>
                <div className="mock-metric"><small>Hours saved</small><strong>11.2</strong><em>↗ 18%</em></div>
                <div className="mock-metric"><small>Bookings</small><strong>37</strong><em>↗ 33%</em></div>
              </div>
              <div className="chart" aria-hidden="true">
                {bars.map((h, i) => (
                  <span key={i} style={{ ['--h' as never]: `${h}%`, ['--i' as never]: i }} />
                ))}
              </div>
              <div className="action-note">
                <strong>AI-drafted next action</strong>
                “Follow up with the 5 inquiries from yesterday — draft replies are ready to approve.”<span className="caret" aria-hidden="true" />
              </div>
              <div className="scan" aria-hidden="true" />
            </div>
          </div>
          <div className="anomaly" role="status">
            <div className="row"><span className="pulse-dot" />Anomaly detected</div>
            <p>Missed-call rate spiked 2.4× this week. Suggested fix is ready to deploy.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <>
      <Nav />
      <Hero />
      <section style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h2 style={{ color: '#c8ff00' }}>Full restore in progress</h2>
        <p style={{ color: '#9aa4b2' }}>The complete landing page is being restored from the last good commit. Refresh in 30 seconds.</p>
        <a href="/workspace" style={{ color: '#c8ff00' }}>Go to Workspace →</a>
      </section>
    </>
  );
}
