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
  const closeMenu = () => setOpen(false);
  return (
    <header className={cls} aria-label="Main navigation">
      <div className="container nav">
        <Logo />
        <nav className="nav-links" aria-label="Main">
          <a href="#services">Services</a>
          <a href="#how">How we work</a>
          <a href="#pricing">Pricing</a>
          <a href="#about">About</a>
        </nav>
        <div className="nav-actions">
          <a className="btn btn-ghost" href="/login">Client Portal</a>
          <a className="btn btn-lime" href="https://wa.me/201028160925" target="_blank" rel="noopener noreferrer">Contact Us <span aria-hidden="true">→</span></a>
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
          <a href="#services" onClick={closeMenu}>Services</a>
          <a href="#how" onClick={closeMenu}>How we work</a>
          <a href="#pricing" onClick={closeMenu}>Pricing</a>
          <a href="#about" onClick={closeMenu}>About</a>
          <a href="/login" onClick={closeMenu}>Client Portal</a>
          <a href="#contact" onClick={closeMenu}>Start Free →</a>
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
          <h1>Automate Smarter.<br /><span className="shimmer">Secure by Design.</span></h1>
          <p className="lead">
            We build intelligent business automation backed by cybersecurity expertise, helping businesses streamline operations without overlooking security.
          </p>
          <div className="hero-ctas">
            <a className="btn btn-lime" href="https://wa.me/201028160925" target="_blank" rel="noopener noreferrer">Discuss Your Project <span aria-hidden="true">→</span></a>
            <a className="btn btn-ghost" href="#how">How we work <span aria-hidden="true">↓</span></a>
          </div>
          <div className="hero-trust">
            <span><i />Cybersecurity expertise</span>
            <span><i />Secure automation</span>
            <span><i />Reliable integrations</span>
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

function Problem() {
  const words = [
    ...'Automation should make work simpler — and security should be part of the design.'.split(' ').map((t) => ({ t, c: 'dim' })),
    { t: 'Corble', c: '' }, { t: 'combines', c: '' }, { t: 'intelligent', c: '' }, { t: 'automation', c: 'hi' },
    { t: 'with', c: '' }, { t: 'cybersecurity', c: 'hi' }, { t: 'expertise', c: '' }, { t: 'from', c: '' },
    { t: 'the', c: '' }, { t: 'first', c: '' }, { t: 'design.', c: 'hi' },
  ];
  return (
    <section className="problem" aria-labelledby="problem-title">
      <div className="container problem-inner reveal">
        <span className="problem-mark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l2.8 2.8m8.4 8.4L19 19M19 5l-2.8 2.8M7.8 16.2 5 19" /></svg>
        </span>
        <h2 id="problem-title" className="problem-statement wordy">
          {words.map((w, i) => (
            <span key={i} className={`w ${w.c}`}>{w.t}{' '}</span>
          ))}
        </h2>
        <p className="problem-sub">We design reliable workflows, integrations, and data handling around the way your business actually operates — with security-conscious engineering throughout.</p>
        <div className="problem-pills" role="list" aria-label="Common tooling problems Corble removes">
          <span className="problem-pill" role="listitem"><span className="bad">✕</span> Fragile manual workflows</span>
          <span className="problem-pill" role="listitem"><span className="bad">✕</span> Disconnected systems</span>
          <span className="problem-pill" role="listitem"><span className="bad">✕</span> Security added too late</span>
          <span className="problem-pill win" role="listitem"><span className="lime" style={{ fontWeight: 800 }}>✓</span> Secure automation by design</span>
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const ticks = ['Business automation', 'Secure integrations', 'Workflow engineering', 'Access control', 'Secure data handling', 'Monitoring', 'Reliable systems'];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[...ticks, ...ticks].map((t, i) => (
          <span key={i}>{t} <i>✦</i></span>
        ))}
      </div>
    </div>
  );
}

const icons = {
  connect: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 15l-3 3a4 4 0 0 1-5.66-5.66" transform="translate(2 2)" /><circle cx="12" cy="12" r="3" /><path d="M6.5 6.5C7.5 4.4 9.6 3 12 3a5.5 5.5 0 0 1 5.4 6.5M17.5 17.5C16.5 19.6 14.4 21 12 21a5.5 5.5 0 0 1-5.4-6.5" /></svg>,
  ask: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /><path d="M8.2 10.6h5.6M11 8v5.6" /></svg>,
  anomaly: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 11l3-8v8l-3 3" transform="translate(1 3)" /><path d="M3 16.5h18" /><path d="M13 3a6 6 0 0 1 6 6c0 2-1 3.5-2 4.5" /></svg>,
  agents: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="7" width="16" height="12" rx="3" /><path d="M12 7V4M9 13h.01M15 13h.01M9.5 16.5h5" /></svg>,
};

function Features() {
  const items = [
    { icon: icons.connect, t: 'Workflow automation', d: 'Automate repetitive business processes and connect the systems your team relies on.' },
    { icon: icons.ask, t: 'AI-powered processes', d: 'Use practical AI where it improves research, routing, communication, and decision support.' },
    { icon: icons.anomaly, t: 'Security-driven engineering', d: 'Build around access control, authentication, secure data handling, and integration reviews.' },
    { icon: icons.agents, t: 'Reliable operations', d: 'Add monitoring, error handling, documentation, and clear ownership to every workflow.' },
  ];
  return (
    <section className="section" id="services">
      <div className="container">
        <div className="section-head reveal">
          <span className="kicker"><b>[ 01 ]</b> capabilities</span>
          <span className="eyebrow">Services</span>
          <h2>Automation with<br /><span className="shimmer">security built in.</span></h2>
          <p>Cybersecurity expertise informs how we design and implement every automation solution.</p>
        </div>
        <div className="features">
          {items.map((it, i) => (
            <article key={it.t} className="fcard reveal" style={{ ['--d' as never]: `${i * 90}ms` }}>
              <div className="ficon">{it.icon}</div>
              <h3>{it.t}</h3>
              <p>{it.d}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [step, setStep] = useState(0);
  const [prog, setProg] = useState(0);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const total = r.height - window.innerHeight;
        const p = Math.min(1, Math.max(0, -r.top / (total || 1)));
        setProg(p);
        setStep(Math.min(2, Math.floor(p * 3)));
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const boards = [
    {
      tag: 'Understand', h: 'Start with the workflow',
      p: 'We map the process, systems, data, and access needs before recommending what should be automated.',
      rows: [['Current process and goals', 'mapped'], ['Systems and integrations', 'reviewed'], ['Data and access boundaries', 'defined']],
      hero: null,
    },
    {
      tag: 'Build', h: 'Implement securely',
      p: 'We connect the right tools, add appropriate controls, and document how the workflow behaves.',
      rows: [['Workflow architecture', 'designed'], ['Authentication and permissions', 'configured'], ['Testing and documentation', 'included']],
      hero: null,
    },
    {
      tag: 'Improve', h: 'Monitor and refine',
      p: 'After launch, monitoring and error handling make it easier to maintain dependable operations as your needs change.',
      rows: [['Errors and edge cases', 'tracked'], ['Workflow health', 'monitored'], ['Changes and ownership', 'documented']],
      hero: null,
    },
  ];

  const steps = [
    { t: 'Understand the process', d: 'We identify the business outcome, current workflow, systems, and security considerations.' },
    { t: 'Build the right solution', d: 'We implement automation and integrations with clear access, data, and failure-handling decisions.' },
    { t: 'Support dependable operations', d: 'We document the system and help you monitor, maintain, and improve it over time.' },
  ];

  return (
    <section className="work" id="how" ref={sectionRef} aria-labelledby="work-title">
      <div className="stage-outer">
        <div className="container stage">
          <div className="stage-head">
            <span className="kicker"><b>[ 02 ]</b> product tour</span>
            <h2 id="work-title">How we <span className="shimmer">work.</span></h2>
            <p style={{ color: 'var(--muted)', margin: '10px 0 0', maxWidth: 520 }}>A practical path from business need to secure, maintainable automation.</p>
          </div>
          <div className="stage-grid">
            <div style={{ position: 'relative' }}>
              <div className="stage-rail" aria-hidden="true"><i style={{ height: `${(prog * 100).toFixed(1)}%` }} /></div>
              <div className="stage-steps">
                {steps.map((s, i) => (
                  <div key={s.t} className={`stage-step${i === step ? ' on' : ''}`}>
                    <div className="stage-num">{`0${i + 1}`}</div>
                    <div>
                      <h3>{s.t}</h3>
                      <p>{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="stage-counter" aria-hidden="true">
                <b>{`0${step + 1}`}</b><span>/ 03</span>
              </div>
            </div>
            <div className="board-stack" aria-live="polite">
              {boards.map((b, i) => {
                const zone = prog * 3 - (i + 0.5);
                const active = i === step;
                return (
                  <div
                    key={b.h}
                    className={`board${active ? '' : ' gone'}`}
                    aria-hidden={!active}
                    style={active ? {
                      transform: `translate3d(0, ${(zone * -20).toFixed(1)}px, ${(zone * 6).toFixed(1)}px) rotateX(${(zone * -2.5).toFixed(2)}deg)`,
                    } : undefined}
                  >
                    <small className="tag"><span className="pulse-dot" />{b.tag}</small>
                    <h4>{b.h}</h4>
                    <p>{b.p}</p>
                    <div className="board-rows">
                      {b.rows.map(([a, o]) => (
                        <div key={a} className="board-row"><span>{a}</span><span className="ok">{o}</span></div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Proof() {
  return (
    <section className="section cv" id="about">
      <div className="container">
        <div className="section-head reveal centered">
          <span className="kicker"><b>[ 03 ]</b> about Corble</span>
          <span className="eyebrow">About Corble</span>
          <h2>Engineering that respects<br /><span className="shimmer">how business works.</span></h2>
          <p>Corble helps businesses turn repetitive work into dependable systems. We combine workflow automation, intelligent integrations, and security-conscious development so technology supports the business instead of creating new operational risk.</p>
        </div>
        <div className="features">
          <article className="fcard reveal"><div className="ficon">{icons.connect}</div><h3>Business context first</h3><p>We start with the process and outcome, not a tool or trend.</p></article>
          <article className="fcard reveal"><div className="ficon">{icons.anomaly}</div><h3>Security-conscious by default</h3><p>Access, data handling, integrations, and failure modes are considered from the beginning.</p></article>
          <article className="fcard reveal"><div className="ficon">{icons.agents}</div><h3>Maintainable systems</h3><p>Clear documentation and ownership help your team operate what we build.</p></article>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      name: 'Starter', price: '8,000', per: 'EGP', usd: 'Approximately $143 USD', desc: 'A focused first workflow for a clear business need.',
      feats: ['One custom automation workflow', 'Up to 3 integrations', 'Basic security configuration', 'Testing and documentation', '14 days of support'],
      cta: 'Start Free', featured: false,
    },
    {
      name: 'Growth', price: '15,000', per: 'EGP', usd: 'Approximately $268 USD', desc: 'For teams connecting multiple workflows and systems.',
      feats: ['Up to 3 automation workflows', 'Up to 5 integrations', 'CRM or database integration', 'Basic business dashboard', 'Security review and error monitoring', '30 days of support'],
      cta: 'Discuss Your Project', featured: true,
    },
    {
      name: 'Business', price: '25,000', per: 'EGP', usd: 'Approximately $446 USD', desc: 'A broader automation system with deeper integration needs.',
      feats: ['Up to 6 automation workflows', 'Multiple system integrations', 'AI integration where applicable', 'Custom business dashboard', 'Advanced workflow security review', 'Monitoring and documentation', '30 days of support'],
      cta: 'Discuss Your Project', featured: false,
    },
    {
      name: 'Custom Solutions', price: 'Custom', per: 'pricing', usd: 'Scope-based proposal', desc: 'For complex systems that need a tailored architecture.',
      feats: ['Complex automation architectures', 'Custom AI-powered systems', 'Security-focused automation projects', 'Custom integrations and infrastructure', 'Tailored support and maintenance'],
      cta: 'Discuss Your Project', featured: false,
    },
  ];
  return (
    <section className="section cv" id="pricing" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div className="container">
        <div className="section-head reveal centered">
          <span className="kicker"><b>[ 04 ]</b> pricing</span>
          <span className="eyebrow">Pricing</span>
          <h2>Clear scope.<br /><span className="shimmer">Practical investment.</span></h2>
          <p>Every project is confirmed in EGP based on its final scope and requirements.</p>
        </div>
        <div className="plans">
          {plans.map((p, i) => (
            <article key={p.name} className={`plan reveal${p.featured ? ' featured' : ''}`} style={{ ['--d' as never]: `${i * 110}ms` }}>
              {p.featured && <span className="plan-badge">Most popular</span>}
              <h3>{p.name}</h3>
              <div className="price">{p.price} <small>{p.per}</small></div>
              <div className="price-usd">{p.usd}</div>
              <p className="plan-desc">{p.desc}</p>
              <ul>
                {p.feats.map(f => <li key={f}>{f}</li>)}
              </ul>
              <a className={`btn ${p.featured ? 'btn-lime' : 'btn-dark'}`} href="#contact">{p.cta}</a>
            </article>
          ))}
        </div>
        <p className="pricing-note">USD equivalents are indicative. Final pricing is confirmed in EGP based on project scope. Third-party API, hosting, and external service costs are quoted separately.</p>
        <div className="maintenance-card reveal">
          <div><span className="eyebrow">Maintenance plans</span><h3>Keep your workflows dependable.</h3><p>Maintenance scope and included support depend on the selected plan.</p></div>
          <div className="maintenance-plans">
            <span><b>Basic</b><strong>1,500 EGP</strong><small>/ month</small></span>
            <span><b>Growth</b><strong>3,000 EGP</strong><small>/ month</small></span>
            <span><b>Business</b><strong>5,000 EGP</strong><small>/ month</small></span>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    { q: 'What exactly does Corble do?', a: 'We build practical websites and automation systems — lead capture, follow-ups, booking handling, WhatsApp workflows, and reporting that pings anomalies. You get outcomes: fewer missed customers, less manual work.' },
    { q: 'Do I need technical skills or another tool to learn?', a: 'No. If you can describe the task in a sentence, Corble can run it. There is intentionally no dashboard full of charts to babysit — the system acts and reports when something needs you.' },
    { q: 'How long until it actually saves me time?', a: 'Most teams see the first automation live within a week and save hours per week within a month. Starter workflows are live in days.' },
    { q: 'Will it work with the tools I already use?', a: 'Corble connects with 40+ platforms including WhatsApp, Google Workspace, Meta, calendars, payments, and CRMs — and we build custom connectors when needed.' },
    { q: 'Is my data safe?', a: 'Yes. Data is encrypted in transit and at rest, access is role-based, and we follow SOC 2 practices. You own your data — export or delete it anytime.' },
  ];
  const [openI, setOpenI] = useState(0);
  return (
    <section className="section cv" id="faq">
      <div className="container">
        <div className="section-head reveal centered">
          <span className="kicker"><b>[ 05 ]</b> faq</span>
          <span className="eyebrow">FAQ</span>
          <h2>Questions, answered.</h2>
        </div>
        <div className="faq">
          {items.map((it, i) => {
            const id = `faq-a-${i}`;
            const open = openI === i;
            return (
              <div key={it.q} className={`faq-item reveal${open ? ' open' : ''}`}>
                <button
                  className="faq-q"
                  id={`faq-q-${i}`}
                  aria-expanded={open}
                  aria-controls={id}
                  onClick={() => setOpenI(open ? -1 : i)}
                >
                  {it.q}
                  <span className="chev" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9l6 6 6-6" /></svg>
                  </span>
                </button>
                <div className="faq-a" id={id} role="region" aria-labelledby={`faq-q-${i}`}><p>{it.a}</p></div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  const [state, setState] = useState('idle');
  const [form, setForm] = useState({ name: '', email: '', business: '', need: '', message: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.includes('@')) {
      setState('error'); return;
    }
    setState('sending');
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setState(res.ok ? 'ok' : 'error');
    } catch {
      setState('error');
    }
  }

  const status = {
    ok: <div className="form-status ok">✓ Request received — we’ll reply within one business day.</div>,
    error: <div className="form-status err">Something went off. Check your details and try again.</div>,
    sending: null,
  }[state];

  return (
    <section className="section cv" id="contact">
      <div className="container contact-wrap">
        <div className="contact-info reveal">
          <span className="kicker" style={{ justifyContent: 'center' }}><b>[ 06 ]</b> contact</span>
          <span className="eyebrow"><span className="pulse-dot" />Let’s talk</span>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', margin: '16px 0 12px' }}>
            Discuss your project.
          </h2>
          <p>Tell us what you want to improve. We’ll come back with a practical recommendation for automation, integrations, and security-conscious implementation.</p>
          <div className="contact-points">
            <div>✓ <span><b>WhatsApp</b> — quick project conversations</span></div>
            <div>✓ <span><b>Email</b> — hello@corble.net</span></div>
            <div>✓ <span><b>Facebook</b> — follow Corble and get in touch</span></div>
          </div>
          <div style={{ marginTop: '28px' }} className="hero-trust">
            <a href="https://wa.me/201028160925" target="_blank" rel="noopener noreferrer"><i />Contact Us on WhatsApp</a>
            <a href="https://www.facebook.com/share/1Cer4m193o/" target="_blank" rel="noopener noreferrer"><i />Facebook</a>
          </div>
        </div>
        <form className="form-card reveal form-card--contact" onSubmit={submit} noValidate>
          <div className="form-row">
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input id="name" name="name" value={form.name} onChange={set('name')} placeholder="Ahmed Hany" required />
            </div>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input id="email" name="email" type="email" value={form.email} onChange={set('email')} placeholder="you@company.com" required />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="business">Business name</label>
              <input id="business" name="business" value={form.business} onChange={set('business')} placeholder="Your business" />
            </div>
            <div className="field">
              <label htmlFor="need">What do you need?</label>
              <select id="need" name="need" value={form.need} onChange={set('need')}>
                <option value="">Choose one…</option>
                <option>Business website</option>
                <option>Automations / workflows</option>
                <option>WhatsApp system</option>
                <option>Not sure — advise me</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="message">What’s the biggest time-waste in your week?</label>
            <textarea id="message" name="message" value={form.message} onChange={set('message')} placeholder="e.g. We lose inquiries that come in after hours…" />
          </div>
          <button className="btn btn-lime" style={{ width: '100%' }} disabled={state === 'sending'}>
            {state === 'sending' ? <span className="spin" /> : null}
            {state === 'sending' ? 'Sending…' : 'Get a Custom Quote →'}
          </button>
          {status}
          <p className="form-note">No spam, no pressure. Just a straight answer.</p>
        </form>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="final-cta cv">
      <span className="eyebrow"><span className="pulse-dot" />Ready when you are</span>
      <h2>Build automation that works.<br /><span className="shimmer">Securely.</span></h2>
      <p>Bring us the workflow, integration, or system you want to improve.</p>
      <a className="btn btn-lime" href="https://wa.me/201028160925" target="_blank" rel="noopener noreferrer">Discuss Your Project <span aria-hidden="true">→</span></a>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="container footer-main">
        <div className="footer-brand">
          <Logo />
          <p>Secure business automation powered by cybersecurity expertise.</p>
        </div>
        <div>
          <h4>Services</h4>
          <ul>
            <li><a href="#services">Business automation</a></li>
            <li><a href="#services">Security-driven engineering</a></li>
            <li><a href="#services">Integrations</a></li>
            <li><a href="#services">Monitoring</a></li>
          </ul>
        </div>
        <div>
          <h4>Company</h4>
          <ul>
            <li><a href="#how">How we work</a></li>
            <li><a href="#about">About Corble</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4>Contact</h4>
          <ul>
            <li><a href="mailto:hello@corble.net">hello@corble.net</a></li>
            <li><a href="https://wa.me/201028160925" target="_blank" rel="noopener noreferrer">WhatsApp</a></li>
            <li><a href="https://www.facebook.com/share/1Cer4m193o/" target="_blank" rel="noopener noreferrer">Facebook</a></li>
          </ul>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Corble. All rights reserved.</span>
        <span>Built with purpose.</span>
      </div>
    </footer>
  );
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://corble.net/#org',
      name: 'Corble',
      url: 'https://corble.net/',
      email: 'hello@corble.net',
      logo: 'https://corble.net/corble-logo-dark.png',
      description:
        'Corble builds secure business automation using cybersecurity expertise and security-conscious engineering.',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://corble.net/#website',
      url: 'https://corble.net/',
      name: 'Corble | Automate Smarter. Secure by Design.',
      description:
        'Intelligent business automation backed by cybersecurity expertise.',
      publisher: { '@id': 'https://corble.net/#org' },
      inLanguage: 'en',
    },
    {
      '@type': 'Service',
      name: 'Secure business automation',
      provider: { '@id': 'https://corble.net/#org' },
      areaServed: 'Worldwide',
      serviceType: ['Workflow automation', 'Secure integrations', 'Security-driven engineering', 'AI-powered business processes'],
      offers: [
        { '@type': 'Offer', name: 'Starter', price: 8000, priceCurrency: 'EGP', description: 'One custom automation workflow with up to 3 integrations.' },
        { '@type': 'Offer', name: 'Growth', price: 15000, priceCurrency: 'EGP', description: 'Up to 3 automation workflows with security review and monitoring.' },
        { '@type': 'Offer', name: 'Business', price: 25000, priceCurrency: 'EGP', description: 'Up to 6 automation workflows with multiple integrations.' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What exactly does Corble do?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We build intelligent business automation backed by cybersecurity expertise, including workflow automation, secure integrations, and security-conscious engineering.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do I need technical skills or another tool to learn?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We start by understanding your process, systems, data, and access needs, then recommend a practical automation approach.',
          },
        },
        {
          '@type': 'Question',
          name: 'How long until it actually saves me time?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Timing depends on the scope, systems involved, access requirements, and testing needed. We confirm the delivery plan before work begins.',
          },
        },
        {
          '@type': 'Question',
          name: 'Will it work with the tools I already use?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We can work with existing CRMs, databases, APIs, communication tools, and business platforms where appropriate.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is my data safe?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Security requirements are considered during architecture, access control, data handling, integration review, monitoring, and documentation. Specific controls depend on the project.',
          },
        },
      ],
    },
  ],
};

export default function Page() {
  useEffect(() => {
    const els = document.querySelectorAll<Element>('.reveal');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const targets = document.querySelectorAll<HTMLElement>('[data-tilt]');
    const max = (el: HTMLElement) => Number(el.dataset.tiltMax || 6);
  const onMove = (e: MouseEvent) => {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateX(${(-y * max(el)).toFixed(2)}deg) rotateY(${(x * max(el)).toFixed(2)}deg)`;
  };
  const onLeave = (e: MouseEvent) => { (e.currentTarget as HTMLElement).style.transform = ''; };
    targets.forEach((el) => {
      el.addEventListener('mousemove', onMove, { passive: true });
      el.addEventListener('mouseleave', onLeave);
    });
    return () => targets.forEach((el) => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    });
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll<HTMLElement>('.wordy .w').forEach((w) => w.classList.add('lit'));
      return;
    }
    const words = document.querySelectorAll<HTMLElement>('.wordy .w');
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const h = document.querySelector('.problem-statement');
        if (h) {
          const r = h.getBoundingClientRect();
          const vh = window.innerHeight;
          const p = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (vh * 0.55)));
          const n = Math.ceil(p * words.length);
          words.forEach((w, i) => w.classList.toggle('lit', i < n));
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const links = document.querySelectorAll('.nav-links a');
    const secs = [...links]
      .map((a) => document.querySelector(a.getAttribute('href') ?? ''))
      .filter((s): s is Element => s !== null);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          const id = en.target.id;
          links.forEach((l: Element) => l.classList.toggle('active', l.getAttribute('href') === `#${id}`));
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = document.querySelectorAll<HTMLElement>('[data-parallax]');
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        els.forEach((el) => {
          const k = Number(el.dataset.parallax || 0.15);
          el.style.translate = `0 ${(-y * k).toFixed(1)}px`;
        });
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <div className="grid-field" aria-hidden="true" />
      <div className="noise" aria-hidden="true" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <a className="skip-link" href="#home">Skip to content</a>
      <Nav />
      <main id="main">
        <Hero />
        <Problem />
        <Marquee />
        <Features />
        <Workflow />
        <Proof />
        <Pricing />
        <FAQ />
        <Contact />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
