'use client';

import { useState } from 'react';
import { useToast } from '@/app/workspace/Shell';

type Entry = { name: string; path: string; type: 'file' | 'dir'; size?: number };
type Conn = { id: string; owner: string; repo: string; branch: string; project?: { name?: string } | null; projectName?: string };

export default function GitHubBrowser({ conn, admin }: { conn: Conn; admin: boolean }) {
  const toast = useToast();
  const [dir, setDir] = useState('');
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<{ path: string; content: string; sha: string } | null>(null);
  const [edited, setEdited] = useState('');
  const [message, setMessage] = useState('');

  async function browse(d = dir) {
    setBusy(true);
    setFile(null);
    setEntries(null);
    const res = await fetch(`/api/github/browse?conn=${conn.id}&dir=${encodeURIComponent(d)}`);
    const json = (await res.json()) as { ok?: boolean; entries?: Entry[]; error?: string };
    setBusy(false);
    if (json.ok && json.entries) {
      setEntries(json.entries);
      setDir(d);
    } else {
      toast(json.error ?? 'Browse failed', 'err');
    }
  }

  async function openFile(path: string) {
    setBusy(true);
    const res = await fetch(`/api/github/file?conn=${conn.id}&path=${encodeURIComponent(path)}`);
    const json = (await res.json()) as { ok?: boolean; content?: string; sha?: string; error?: string; branch?: string };
    setBusy(false);
    if (json.ok && json.content !== undefined) {
      setFile({ path, content: json.content, sha: json.sha ?? '' });
      setEdited(json.content);
      setMessage('');
    } else {
      toast(json.error ?? 'Cannot read file (binary or too large)', 'err');
    }
  }

  async function save() {
    if (!file) return;
    setBusy(true);
    const res = await fetch('/api/github/file', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ connId: conn.id, path: file.path, content: edited, message: message || undefined, expectedSha: file.sha }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string; commitSha?: string; diff?: { added: number; removed: number } };
    setBusy(false);
    if (json.ok) {
      toast(`Committed ${json.diff ? `(+${json.diff.added}/−${json.diff.removed})` : ''} → ${json.commitSha ?? 'sha'}`, 'ok');
      setFile(null);
      setEntries(null);
      setMessage('');
    } else {
      toast(json.error ?? 'Commit failed', 'err');
    }
  }

  const up = dir ? dir.split('/').slice(0, -1).join('/') : null;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>{conn.owner}/{conn.repo}</strong>
        <span className="pill">{conn.branch}</span>
        {conn.projectName ? <span className="itemsub">site: {conn.projectName}</span> : null}
        <a className="btn" href={`/api/github/download?conn=${conn.id}&dir=${encodeURIComponent(dir)}`} target="_blank" rel="noopener noreferrer">⇩ ZIP current dir</a>
      </div>

      <div style={{ display: 'flex', gap: 6, margin: '8px 0', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn" disabled={busy} onClick={() => browse('')}>Home</button>
        {up !== null && up !== dir ? <button className="btn" disabled={busy} onClick={() => browse(up)}>↑ Up</button> : null}
        <span className="pill">path: /{dir}</span>
        {busy ? <span className="pill">loading…</span> : null}
      </div>

      <div className="tablewrap">
        <table className="table">
          <tbody>
            {entries === null && !busy ? (
              <tr><td className="empty">No directory loaded yet — press Home.</td></tr>
            ) : null}
            {busy ? <tr><td className="empty">Loading tree…</td></tr> : null}
            {(entries ?? []).map((e) => (
              <tr key={e.path}>
                <td>
                  {e.type === 'dir' ? (
                    <button className="btn" disabled={busy} onClick={() => browse(e.path)}>📁 {e.name}</button>
                  ) : (
                    <>
                      <button className="btn" disabled={busy} onClick={() => openFile(e.path)}>📄 {e.name}</button>
                      <a className="itemsub" style={{ marginLeft: 8, color: 'var(--purple)' }} href={`/api/github/download?conn=${conn.id}&paths=${encodeURIComponent(e.path)}`} target="_blank" rel="noopener noreferrer">⇩</a>
                    </>
                  )}
                </td>
                <td style={{ width: 120 }}>{e.type === 'dir' ? 'folder' : e.size !== undefined ? `${Math.max(1, Math.round(e.size / 1024))} KB` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {file ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong>{file.path}</strong>
            <span className="pill">{file.sha.slice(0, 10)}</span>
            <input className="textinput" style={{ maxWidth: 260 }} placeholder="Commit message (optional)" value={message} onChange={(e) => setMessage(e.target.value)} />
            <button className="btn" disabled={busy || !admin || edited === file.content} onClick={save} title={admin ? 'Commit to branch' : 'Admin commits only'}>Save & commit</button>
            <button className="btn sq" disabled={busy} onClick={() => setFile(null)} title="Close file" aria-label="Close file editor">✕</button>
            {!admin ? <span className="itemsub">read-only — commits are admin-only, and never to main/production branches.</span> : null}
          </div>
          <textarea
            style={{ width: '100%', minHeight: 260, background: 'rgba(255,255,255,.04)', color: 'var(--ink)', border: '1px solid rgba(128,128,128,.3)', borderRadius: 8, padding: 10, fontFamily: 'monospace', fontSize: 12, marginTop: 8 }}
            value={edited}
            disabled={!admin}
            onChange={(e) => setEdited(e.target.value)}
            spellCheck={false}
          />
        </div>
      ) : null}
    </div>
  );
}
