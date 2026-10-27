'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/workspace/Shell';
import ModalForm from './ModalForm';

export default function FileUploader({ projects }: { projects: { id: string; name: string }[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const [project, setProject] = useState('');

  async function upload() {
    const input = inputRef.current;
    const file = input?.files?.[0];
    if (!file) {
      toast('Choose a file first.', 'err');
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    if (project) fd.append('projectId', project);
    try {
      const res = await fetch('/api/files', { method: 'POST', body: fd });
      const json = (await res.json()) as { ok: boolean; error?: string; backend?: string };
      if (!json.ok) {
        toast(json.error ?? 'Upload failed.', 'err');
      } else {
        toast(`Uploaded (${json.backend === 's3' ? 'S3' : 'local storage'}).`);
        if (input) input.value = '';
        router.refresh();
      }
    } catch {
      toast('Upload failed.', 'err');
    }
    setBusy(false);
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <select style={{ maxWidth: 200 }} value={project} onChange={(e) => setProject(e.target.value)} aria-label="Attach to project">
        <option value="">No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <input ref={inputRef} type="file" style={{ maxWidth: 220 }} aria-label="Choose file to upload" />
      <button className="btn primary" type="button" onClick={upload} disabled={busy}>
        {busy ? 'Uploading…' : '⬆ Upload'}
      </button>
    </div>
  );
}

export { ModalForm };
