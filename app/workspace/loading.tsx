export default function WorkspaceLoading() {
  return (
    <>
      <div className="kpis" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <div className="kpi" key={i} style={{ opacity: 0.55 }}>
            <div className="klabel" style={{ background: 'var(--track)', color: 'transparent', borderRadius: 6, height: 10, width: '55%' }}>·</div>
            <div className="num" style={{ background: 'var(--track)', color: 'transparent', borderRadius: 8, height: 26, width: '38%', marginTop: 10 }}>·</div>
          </div>
        ))}
      </div>
      <div className="grid" aria-hidden="true">
        <section className="card wide" style={{ opacity: 0.55, height: 220 }}>
          <div className="panelhead">
            <h2 style={{ background: 'var(--track)', color: 'transparent', borderRadius: 6, width: 220, height: 14 }}>·</h2>
          </div>
        </section>
        <section className="card" style={{ opacity: 0.55, height: 200 }} />
        <section className="card" style={{ opacity: 0.55, height: 200 }} />
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>Loading…</p>
    </>
  );
}
