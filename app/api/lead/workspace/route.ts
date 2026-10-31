import { dbUser } from '@/lib/guard';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  const user = await dbUser();
  if (!user) return Response.json({ ok: false, error: 'Sign in first.' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { datasetId?: string } | null;
  if (!body?.datasetId) return Response.json({ ok: false, error: 'Dataset is required.' }, { status: 400 });
  const dataset = await db.leadDataset.findUnique({ where: { id: body.datasetId }, select: { id: true } });
  if (!dataset) return Response.json({ ok: false, error: 'Dataset not found.' }, { status: 404 });
  await db.leadWorkspaceState.upsert({
    where: { userId: user.id },
    create: { userId: user.id, activeDatasetId: dataset.id },
    update: { activeDatasetId: dataset.id },
  });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await dbUser();
  if (!user) return Response.json({ ok: false, error: 'Sign in first.' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('datasetId');
  if (!id) return Response.json({ ok: false, error: 'Dataset is required.' }, { status: 400 });
  const dataset = await db.leadDataset.findUnique({ where: { id }, select: { id: true, fileAssetId: true, ownerId: true } });
  if (!dataset) return Response.json({ ok: false, error: 'Dataset not found.' }, { status: 404 });
  if (user.role !== 'ADMIN' && dataset.ownerId !== user.id) return Response.json({ ok: false, error: 'You cannot remove this draft.' }, { status: 403 });
  await db.$transaction([
    db.leadWorkspaceState.updateMany({ where: { userId: user.id, activeDatasetId: id }, data: { activeDatasetId: null } }),
    db.fileAsset.delete({ where: { id: dataset.fileAssetId } }),
  ]);
  return Response.json({ ok: true });
}
