import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatMoney, formatDate } from '@/lib/format';
import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await auth();
  const userId = session!.user.id;
  const role = session!.user.role;

  const [settings, user, stats] = await Promise.all([
    db.settings.upsert({ where: { id: 'global' }, update: {}, create: { id: 'global' } }),
    db.user.findUnique({ where: { id: userId } }),
    Promise.all([db.lead.count(), db.project.count(), db.task.count(), db.fileAsset.count()]),
  ]);
  if (!user) return null;

  return (
    <>
      <div className="viewhead">
        <div>
          <h2>Workspace settings</h2>
          {role === 'ADMIN' ? (
            <div className="sub">Admins can change company-level values; they apply everywhere immediately.</div>
          ) : (
            <div className="sub">Only admins can change company settings. You can toggle your own theme.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="panelhead"><h2>Company preferences</h2></div>
        <SettingsForm
          current={{
            companyName: settings.companyName,
            currency: settings.currency as 'EGP' | 'USD',
            timezone: settings.timezone,
            theme: (user?.theme === 'light' ? 'light' : 'dark') as 'dark' | 'light',
          }}
          isAdmin={role === 'ADMIN'}
        />
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="panelhead"><h2>Your account</h2></div>
        <div style={{ display: 'grid', gap: 8, fontSize: 13.5 }}>
          <div><b>{user?.name}</b> · {user?.email} · <span className={`pill ${user?.role === 'ADMIN' ? 'won' : ''}`}>{user?.role}</span></div>
          <div className="itemsub">Theme preference is saved to your user record — media theme applies on every device after sign in.</div>
          <div className="itemsub">Workspace totals: {stats[0]} leads · {stats[1]} projects · {stats[2]} tasks · {stats[3]} files · currency {formatMoney(1000, settings.currency as 'EGP' | 'USD')} sample · member since {formatDate(user?.createdAt)}</div>
        </div>
      </div>
    </>
  );
}
