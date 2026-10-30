'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type {
  LeadStatus,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  FinanceType,
  FinanceStatus,
  Role,
} from '@prisma/client';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import {
  leadSchema,
  githubConnectSchema,
  deployConfigSchema,
  templateImportSchema,
  leadStatusSchema,
  projectSchema,
  projectStatusSchema,
  taskSchema,
  taskInlineSchema,
  financeSchema,
  userAdminSchema,
  userUpdateSchema,
  settingsSchema,
  passwordResetSchema,
  templateUseSchema,
  notificationReadSchema,
  handoverRequestSchema,
  handoverDecisionSchema,
  taskEligibilitySchema,
  taskCommentSchema,
  deliverableSchema,
  deliverableVersionSchema,
  deliverableReviewSchema,
  researchUpdateSchema,
  verifyActionSchema,
  promoteLeadSchema,
  automationSchema,
  phaseSchema,
  phaseSubmitSchema,
  phaseReviewSchema,
  finalDeliverySchema,
  acceptDeliverySchema,
} from '@/lib/validators';
import { notifyTaskAssigned, notifyBranded } from '@/lib/mail';
import { safeFetch } from '@/lib/urlguard';
import { domainFromEmail } from '@/lib/ingest';
import { allocateLeadCode } from '@/lib/lead-id';

export type ActionResult = { ok: boolean; error?: string; message?: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  // Re-verify from the database: never trust role/isActive claims in the JWT.
  const dbu = await db.user.findUnique({ where: { id: session.user.id as string }, select: { id: true, role: true, name: true, isActive: true } });
  if (!dbu || !dbu.isActive) throw new Error('INACTIVE');
  return { id: dbu.id, role: dbu.role as Role, name: dbu.name ?? '' };
}

async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== 'ADMIN') throw new Error('Admins only');
  return u;
}

async function logActivity(userId: string | null, message: string, detail?: string) {
  await db.activity.create({ data: { message, detail: detail ?? null, userId } });
}

function fail(e: unknown): ActionResult {
  if (e instanceof z.ZodError) {
    return { ok: false, error: e.issues[0]?.message ?? 'Invalid input' };
  }
  if (e instanceof Error) {
    if (e.message === 'Admins only') return { ok: false, error: 'Only admins can do that.' };
    if (e.message === 'Unauthorized') return { ok: false, error: 'Please sign in again.' };
    if (e.message === 'INACTIVE') return { ok: false, error: 'Your account has been deactivated by an administrator.' };
  }
  return { ok: false, error: 'Something went wrong. Try again.' };
}

function okRes(message: string): ActionResult {
  return { ok: true, message };
}

type BrandedMail = Parameters<typeof notifyBranded>[0];
/** Fire-and-forget branded email; never let mail failures bubble into actions. */
function sendBrandedMail(a: BrandedMail) {
  return notifyBranded(a)
    .then((r) => {
      if (!r?.ok) console.warn('[mail] event email skipped:', r?.error ?? 'unknown');
    })
    .catch((e) => console.error('[mail] event email crashed:', e));
}
/** Look up a user's email/name then send the branded mail (no-op when unconfigured). The send runs in `after()` so it never delays the action response. */
async function mailUser(
  userId: string | null | undefined,
  build: (p: { email: string; name: string }) => Omit<BrandedMail, 'to' | 'headingName'>
) {
  if (!userId) return;
  const usr = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!usr?.email) return;
  const mail: BrandedMail = {
    ...build({ email: usr.email, name: usr.name }),
    to: usr.email,
    headingName: usr.name,
  };
  after(() => sendBrandedMail(mail));
}
const FOOTER = 'You are receiving this because of activity on your assigned work in Corble Workspace.';

async function notifyAssigneeIfAny(
  assigneeId: string | null | undefined,
  task: { title: string; priority: string; status: string; dueDate: Date | null; projectId?: string | null },
  assignedByName: string,
) {
  if (!assigneeId) return;
  const assignee = await db.user.findUnique({
    where: { id: assigneeId },
    select: { email: true, name: true },
  });
  if (!assignee?.email) return;
  let projectName: string | null = null;
  if (task.projectId) {
    const p = await db.project.findUnique({ where: { id: task.projectId }, select: { name: true } });
    projectName = p?.name ?? null;
  }
  after(() =>
    notifyTaskAssigned({
      assigneeEmail: assignee.email,
      assigneeName: assignee.name,
      taskTitle: task.title,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
      assignedBy: assignedByName,
      projectName,
    }).catch((e) => {
      console.error('[mail] task-assignment email crashed:', e);
    })
  );
}

/* ------------------------------ LEADS ------------------------------ */

export async function createLead(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = leadSchema.parse(raw);
    const lead = await db.$transaction(async (tx) => tx.lead.create({
      data: {
        leadCode: await allocateLeadCode(tx),
        name: input.name,
        contactPerson: input.contactPerson || null,
        email: input.email || null,
        phone: input.phone || null,
        website: input.website || null,
        industry: input.industry || null,
        city: input.city || null,
        country: input.country || null,
        notes: input.notes || null,
        service: input.service,
        source: input.source,
        status: input.status as LeadStatus,
        estValue: input.estValue,
        nextFollowUp: input.nextFollowUp,
        ownerId: input.ownerId ?? null,
      },
    }));
    await logActivity(u.id, 'Lead created', `${lead.name} Â· ${lead.service}`);
    revalidatePath('/workspace');
    revalidatePath('/workspace/leads');
    return okRes('Lead added.');
  } catch (e) {
    return fail(e);
  }
}

export async function updateLead(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = leadSchema.parse(raw);
    const id = (raw as { id?: string }).id ?? '';
    const lead = await db.lead.update({
      where: { id },
      data: {
        name: input.name,
        contactPerson: input.contactPerson || null,
        email: input.email || null,
        phone: input.phone || null,
        website: input.website || null,
        industry: input.industry || null,
        city: input.city || null,
        country: input.country || null,
        notes: input.notes || null,
        service: input.service,
        source: input.source,
        status: input.status as LeadStatus,
        estValue: input.estValue,
        nextFollowUp: input.nextFollowUp,
        ownerId: input.ownerId ?? null,
      },
    });
    await logActivity(u.id, 'Lead updated', lead.name);
    revalidatePath('/workspace/leads');
    revalidatePath('/workspace');
    return okRes('Lead updated.');
  } catch (e) {
    return fail(e);
  }
}

export async function setLeadStatus(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const { id, status } = leadStatusSchema.parse(raw);
    const lead = await db.lead.update({ where: { id }, data: { status: status as LeadStatus } });
    await logActivity(u.id, 'Lead status changed', `${lead.name} â†’ ${status}`);
    revalidatePath('/workspace/leads');
    revalidatePath('/workspace');
    return okRes('Status saved.');
  } catch (e) {
    return fail(e);
  }
}

export async function deleteLead(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const id = z.string().min(1).parse(raw);
    // Any incoming leads that were promoted into this record are re-opened on delete (D5),
    // so they never stay stuck in PROMOTED with no visible actions.
    const linked = await db.incomingLead.findMany({ where: { finalLeadId: id }, select: { id: true, company: true } });
    const lead = await db.lead.delete({ where: { id } });
    if (linked.length > 0) {
      await db.incomingLead.updateMany({ where: { id: { in: linked.map((l) => l.id) } }, data: { processingStatus: 'UNDER_REVIEW', finalLeadId: null } });
      for (const l of linked) {
        await logActivity(u.id, 'Incoming lead re-opened', `${l.company} — its final lead was deleted`);
      }
    }
    await logActivity(u.id, 'Lead deleted', lead.name);
    revalidatePath('/workspace/leads');
    revalidatePath('/workspace/leads/incoming');
    revalidatePath('/workspace');
    return okRes(linked.length ? `Lead deleted. ${linked.length} promoted incoming lead(s) re-opened for review.` : 'Lead deleted.');
  } catch (e) {
    return fail(e);
  }
}

export async function bulkDeleteLeads(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const ids = z.array(z.string().min(1)).min(1).parse(raw);
    const linked = await db.incomingLead.findMany({ where: { finalLeadId: { in: ids } }, select: { id: true } });
    const out = await db.lead.deleteMany({ where: { id: { in: ids } } });
    if (linked.length > 0) {
      await db.incomingLead.updateMany({ where: { id: { in: linked.map((l) => l.id) } }, data: { processingStatus: 'UNDER_REVIEW', finalLeadId: null } });
    }
    await logActivity(u.id, 'Leads bulk-deleted', `${out.count} of ${ids.length} selected${linked.length ? `; ${linked.length} incoming re-opened` : ''}`);
    revalidatePath('/workspace/leads');
    revalidatePath('/workspace/leads/incoming');
    revalidatePath('/workspace');
    return okRes(`${out.count} lead${out.count === 1 ? '' : 's'} deleted.${linked.length ? ` ${linked.length} incoming re-opened.` : ''}`);
  } catch (e) {
    return fail(e);
  }
}

// D5: safe un-promote — clears the link and re-opens the incoming record.
export async function unpromoteIncoming(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const id = z.string().min(1).parse(raw);
    const lead = await db.incomingLead.findUnique({
      where: { id },
      select: { id: true, company: true, processingStatus: true, finalLeadId: true, finalLead: { select: { name: true } } },
    });
    if (!lead) return { ok: false, error: 'Incoming lead not found.' };
    if (lead.processingStatus !== 'PROMOTED' || !lead.finalLeadId) {
      return { ok: false, error: 'Not promoted — nothing to un-promote.' };
    }
    await db.$transaction(async (tx) => {
      await tx.incomingLead.update({
        where: { id: lead.id },
        data: { processingStatus: 'UNDER_REVIEW', finalLeadId: null, reviewedById: u.id },
      });
      await tx.activity.create({
        data: {
          message: 'Lead un-promoted',
          detail: `${lead.company}: link to final lead "${lead.finalLead?.name ?? lead.finalLeadId}" cleared; reopened for review`,
          userId: u.id,
        },
      });
    });
    revalidatePath('/workspace/leads/incoming');
    return okRes('Un-promoted. The incoming lead is open for review again (final lead untouched).');
  } catch (e) {
    return fail(e);
  }
}

export async function convertLead(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const id = z.string().min(1).parse(raw);
    const lead = await db.lead.findUnique({ where: { id }, include: { projects: true } });
    if (!lead) return { ok: false, error: 'Lead not found.' };
    if (lead.projects.length > 0) return { ok: false, error: 'A project already exists for this lead.' };
    const project = await db.project.create({
      data: {
        name: `${lead.name} â€” ${lead.service}`,
        clientName: lead.name,
        leadId: lead.id,
        service: lead.service,
        status: 'IN_PROGRESS' as ProjectStatus,
        progress: 5,
        dueDate: lead.nextFollowUp ? new Date(lead.nextFollowUp.getTime() + 14 * 24 * 3600 * 1000) : null,
        ownerId: lead.ownerId ?? null,
        budget: lead.estValue,
      },
    });
    await logActivity(u.id, 'Lead converted to project', project.name);
    revalidatePath('/workspace/projects');
    revalidatePath('/workspace/leads');
    return okRes('Project created from lead.');
  } catch (e) {
    return fail(e);
  }
}

/* ---------------------------- PROJECTS ----------------------------- */

export async function createProject(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = projectSchema.parse(raw);
    const p = await db.project.create({
      data: {
        name: input.name,
        clientName: input.clientName,
        leadId: input.leadId ?? null,
        service: input.service,
        status: input.status as ProjectStatus,
        progress: input.progress,
        dueDate: input.dueDate,
        ownerId: input.ownerId ?? null,
        budget: input.budget,
      },
    });
    await logActivity(u.id, 'Project created', p.name);
    revalidatePath('/workspace');
    revalidatePath('/workspace/projects');
    return okRes('Project created.');
  } catch (e) {
    return fail(e);
  }
}

export async function updateProject(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = projectSchema.parse(raw);
    const id = (raw as { id?: string }).id ?? '';
    const p = await db.project.update({
      where: { id },
      data: {
        name: input.name,
        clientName: input.clientName,
        leadId: input.leadId ?? null,
        service: input.service,
        status: input.status as ProjectStatus,
        progress: input.progress,
        dueDate: input.dueDate,
        ownerId: input.ownerId ?? null,
        budget: input.budget,
      },
    });
    await logActivity(u.id, 'Project updated', p.name);
    revalidatePath('/workspace/projects');
    revalidatePath('/workspace');
    return okRes('Project updated.');
  } catch (e) {
    return fail(e);
  }
}

export async function setProjectStatus(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const { id, status } = projectStatusSchema.parse(raw);
    const p = await db.project.update({ where: { id }, data: { status: status as ProjectStatus } });
    await logActivity(u.id, 'Project status changed', `${p.name} â†’ ${status}`);
    revalidatePath('/workspace/projects');
    revalidatePath('/workspace');
    return okRes('Status saved.');
  } catch (e) {
    return fail(e);
  }
}

export async function deleteProject(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const id = z.string().min(1).parse(raw);
    const p = await db.project.delete({ where: { id } });
    await logActivity(u.id, 'Project deleted', p.name);
    revalidatePath('/workspace/projects');
    revalidatePath('/workspace');
    return okRes('Project deleted.');
  } catch (e) {
    return fail(e);
  }
}

/* ------------------------------ TASKS ------------------------------ */

export async function createTask(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = taskSchema.parse(raw);
    const t = await db.task.create({
      data: {
        title: input.title,
        description: input.description,
        projectId: input.projectId ?? null,
        leadId: input.leadId ?? null,
        assigneeId: input.assigneeId ?? null,
        originalOwnerId: input.assigneeId ?? null,
        createdById: u.id,
        priority: input.priority as TaskPriority,
        status: input.status as TaskStatus,
        startDate: input.startDate,
        dueDate: input.dueDate,
      },
    });
    await logActivity(u.id, 'Task created', t.title);
    await notifyAssigneeIfAny(input.assigneeId, t, u.name);
    revalidatePath('/workspace');
    revalidatePath('/workspace/tasks');
    revalidatePath('/workspace/tasks/team');
    return okRes('Task added.');
  } catch (e) {
    return fail(e);
  }
}

export async function updateTask(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = taskSchema.parse(raw);
    const id = (raw as { id?: string }).id ?? '';
    const before = await db.task.findUnique({ where: { id }, select: { title: true, assigneeId: true, originalOwnerId: true } });
    const prev = before;
    const t = await db.task.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        projectId: input.projectId ?? null,
        leadId: input.leadId ?? null,
        assigneeId: input.assigneeId ?? null,
        originalOwnerId: before?.originalOwnerId ?? input.assigneeId ?? null,
        priority: input.priority as TaskPriority,
        status: input.status as TaskStatus,
        startDate: input.startDate,
        dueDate: input.dueDate,
        completedAt: input.status === 'DONE' ? new Date() : null,
      },
    });
    if (before && before.assigneeId !== t.assigneeId && t.assigneeId) {
      await notify(t.assigneeId, 'TASK_REASSIGNED', `A task is now yours: "${t.title}"`, undefined, '/workspace/tasks');
      const penders = await db.handoverRequest.findMany({ where: { taskId: id, status: 'PENDING' }, select: { requesterId: true } });
      await db.handoverRequest.updateMany({ where: { taskId: id, status: 'PENDING' }, data: { status: 'REJECTED', decidedById: u.id, decidedAt: new Date() } });
      if (penders.length > 0) {
        await notify(t.assigneeId!, 'HANDOVER_CANCELLED', `Pending handover requests on "${t.title}" were closed automatically`, 'Task was reassigned during the update.', '/workspace/tasks');
        for (const r of penders) {
          if (r.requesterId === u.id) continue;
          await mailUser(r.requesterId, ({ name }) => ({
            eyebrow: 'Corble · Handover closed',
            introName: `a request of yours on a task was automatically closed.`,
            message: `Handover requests on "${t.title}" were closed`,
            body: 'The task was reassigned during an update, so pending requests were resolved as rejected.',
            ctaLabel: 'Open tasks →',
            ctaPath: '/workspace/tasks/team',
            footer: FOOTER,
          }));
        }
      }
    }
    await logActivity(u.id, 'Task updated', t.title);
    if (input.assigneeId && input.assigneeId !== prev?.assigneeId) {
      await notifyAssigneeIfAny(input.assigneeId, t, u.name);
    }
    revalidatePath('/workspace/tasks');
    revalidatePath('/workspace/tasks/team');
    revalidatePath('/workspace');
    return okRes('Task updated.');
  } catch (e) {
    return fail(e);
  }
}

export async function updateTaskInline(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const { id, status, priority, assigneeId } = taskInlineSchema.parse(raw);
    const prev = await db.task.findUnique({ where: { id }, select: { assigneeId: true, title: true } });
    const t = await db.task.update({
      where: { id },
      data: {
        ...(status ? { status: status as TaskStatus } : {}),
        ...(priority ? { priority: priority as TaskPriority } : {}),
        ...(assigneeId !== undefined ? { assigneeId: assigneeId || null } : {}),
      },
    });
    await logActivity(u.id, 'Task updated', t.title);
    const newAssignee = assigneeId !== undefined ? (assigneeId || null) : prev?.assigneeId;
    if (newAssignee && newAssignee !== prev?.assigneeId) {
      await notifyAssigneeIfAny(newAssignee, t, u.name);
      // Reassignment resolves pending handover requests safely (B4) — they now point at a stale owner.
      const penders = await db.handoverRequest.findMany({
        where: { taskId: t.id, status: 'PENDING' },
        select: { requesterId: true },
      });
      if (penders.length > 0) {
        await db.handoverRequest.updateMany({
          where: { taskId: t.id, status: 'PENDING' },
          data: { status: 'CANCELLED', decidedById: u.id, decidedAt: new Date() },
        });
        for (const r of penders) {
          for (const partyId of [r.requesterId, prev?.assigneeId ?? null]) {
            if (!partyId || partyId === u.id) continue;
            await notify(partyId, 'HANDOVER_CANCELLED', `Handover request cancelled — "${t.title}" was reassigned`, undefined, '/workspace/tasks');
            await mailUser(partyId, () => ({
              eyebrow: 'Corble · Handover request',
              introName: `a handover request on "${t.title}" was closed automatically.`,
              message: `The task was reassigned, so its pending handover requests were cancelled.`,
              body: 'Open the tasks view to request the task again if takeover is still needed.',
              ctaLabel: 'Open tasks →',
              ctaPath: '/workspace/tasks',
              footer: FOOTER,
            }));
          }
        }
      }
    }
    revalidatePath('/workspace/tasks');
    revalidatePath('/workspace');
    return okRes('Task saved.');
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTask(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const id = z.string().min(1).parse(raw);
    // Soft-delete: comments, handover history and deliverables must survive.
    const t = await db.task.update({ where: { id }, data: { deletedAt: new Date(), eligibleForHandover: false } });
    // Resolve pending handover requests safely now the task is gone.
    const pending = await db.handoverRequest.findMany({
      where: { taskId: id, status: 'PENDING' },
      select: { requesterId: true, ownerId: true, requester: { select: { name: true } } },
    });
    if (pending.length > 0) {
      await db.handoverRequest.updateMany({ where: { taskId: id, status: 'PENDING' }, data: { status: 'CANCELLED', decidedAt: new Date() } });
      for (const r of pending) {
        for (const partyId of [r.requesterId, r.ownerId]) {
          if (!partyId || partyId === u.id) continue;
          await db.notification.create({
            data: { userId: partyId, type: 'HANDOVER_CANCELLED', title: `Handover request cancelled — task "${t.title}" was deleted`, link: '/workspace/tasks' },
          });
          await mailUser(partyId, () => ({
            eyebrow: 'Corble · Task handover',
            introName: 'a handover request was automatically cancelled.',
            message: `Task "${t.title}" was deleted while its handover request was pending.`,
            body: 'No action is needed — the request no longer applies.',
            ctaLabel: 'Open tasks →',
            ctaPath: '/workspace/tasks',
            footer: FOOTER,
          }));
        }
      }
    }
    await logActivity(u.id, 'Task deleted', t.title);
    revalidatePath('/workspace/tasks');
    revalidatePath('/workspace');
    return okRes('Task deleted.');
  } catch (e) {
    return fail(e);
  }
}

/* ----------------------------- FINANCE ----------------------------- */

export async function createFinance(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = financeSchema.parse(raw);
    const f = await db.financeRecord.create({
      data: {
        type: input.type as FinanceType,
        description: input.description,
        amount: input.amount,
        status: input.status as FinanceStatus,
        date: input.date,
        projectId: input.projectId ?? null,
      },
    });
    await logActivity(u.id, `Finance record added (${f.type})`, `${f.description}`);
    revalidatePath('/workspace');
    revalidatePath('/workspace/finance');
    return okRes('Record added.');
  } catch (e) {
    return fail(e);
  }
}

export async function updateFinance(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = financeSchema.parse(raw);
    const id = (raw as { id?: string }).id ?? '';
    const f = await db.financeRecord.update({
      where: { id },
      data: {
        type: input.type as FinanceType,
        description: input.description,
        amount: input.amount,
        status: input.status as FinanceStatus,
        date: input.date,
        projectId: input.projectId ?? null,
      },
    });
    await logActivity(u.id, 'Finance record updated', f.description);
    revalidatePath('/workspace/finance');
    revalidatePath('/workspace');
    return okRes('Record updated.');
  } catch (e) {
    return fail(e);
  }
}

export async function deleteFinance(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const id = z.string().min(1).parse(raw);
    const f = await db.financeRecord.delete({ where: { id } });
    await logActivity(u.id, 'Finance record deleted', f.description);
    revalidatePath('/workspace/finance');
    revalidatePath('/workspace');
    return okRes('Record deleted.');
  } catch (e) {
    return fail(e);
  }
}

/* ------------------------------- TEAM ------------------------------ */

export async function addTeamUser(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireAdmin();
    const input = userAdminSchema.parse(raw);
    const exists = await db.user.findUnique({ where: { email: input.email } });
    if (exists) return { ok: false, error: 'A user with that email already exists.' };
    if (!input.password) return { ok: false, error: 'A temporary password (min 8 characters) is required for new team members.' };
    const password = input.password;
    await db.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await bcrypt.hash(password, 10),
        role: input.role as Role,
      },
    });
    await logActivity(u.id, 'Team member added', `${input.name} (${input.role})`);
    revalidatePath('/workspace/team');
    return okRes('User added.');
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTeamUser(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireAdmin();
    const id = z.string().min(1).parse(raw);
    if (id === u.id) return { ok: false, error: 'You cannot remove your own account.' };
    // Soft-delete: deactivate instead of destroying history. Password is cleared
    // and sessions die on the next privileged action via the DB isActive re-check.
    const user = await db.user.update({
      where: { id },
      data: { isActive: false, passwordHash: null },
    });
    await logActivity(u.id, 'Team member deactivated', user.name);
    revalidatePath('/workspace/team');
    return okRes('Team member deactivated (history preserved).');
  } catch (e) {
    return fail(e);
  }
}

export async function updateTeamUser(raw: unknown): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const input = userUpdateSchema.parse(raw);
    const emailTaken = await db.user.findFirst({ where: { email: input.email, NOT: { id: input.id } } });
    if (emailTaken) return { ok: false, error: 'Another user already uses that email.' };
    const user = await db.user.update({
      where: { id: input.id },
      data: { name: input.name, email: input.email, role: input.role as Role },
    });
    await logActivity(admin.id, 'Team member updated', `${user.name} (${user.role})`);
    revalidatePath('/workspace/team');
    revalidatePath(`/workspace/profile/${user.id}`);
    revalidatePath('/workspace/profile/me');
    return okRes('Profile updated.');
  } catch (e) {
    return fail(e);
  }
}

export async function toggleTeamUserActive(raw: unknown): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = z.string().min(1).parse(raw);
    if (id === admin.id) return { ok: false, error: 'You cannot change your own active state.' };
    const user = await db.user.findUnique({ where: { id }, select: { name: true, isActive: true } });
    if (!user) return { ok: false, error: 'User not found.' };
    const updated = await db.user.update({ where: { id }, data: { isActive: !user.isActive } });
    await logActivity(admin.id, updated.isActive ? 'Member reactivated' : 'Member deactivated', user.name);
    revalidatePath('/workspace/team');
    revalidatePath(`/workspace/profile/${id}`);
    return okRes(updated.isActive ? 'Member reactivated.' : 'Member deactivated.');
  } catch (e) {
    return fail(e);
  }
}

/** Removes a member from their profile page, then returns to the team list. */
export async function removeTeamUserAndExit(raw: unknown): Promise<ActionResult> {
  const res = await deleteTeamUser(raw);
  if (res.ok) redirect('/workspace/team');
  return res;
}

export async function resetTeamPassword(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireAdmin();
    const input = passwordResetSchema.parse(raw);
    const user = await db.user.update({
      where: { id: input.userId },
      data: { passwordHash: await bcrypt.hash(input.password, 10) },
    });
    await logActivity(u.id, 'Password reset', user.name);
    revalidatePath('/workspace/team');
    return okRes('Password updated.');
  } catch (e) {
    return fail(e);
  }
}

export async function saveMyTheme(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const theme = z.enum(['dark', 'light']).parse(raw);
    await db.user.update({ where: { id: u.id }, data: { theme } });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ----------------------------- SETTINGS ----------------------------- */

export async function saveSettings(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireAdmin();
    const input = settingsSchema.parse(raw);
    const s = await db.settings.upsert({
      where: { id: 'global' },
      update: {
        companyName: input.companyName,
        currency: input.currency,
        timezone: input.timezone,
        theme: input.theme,
      },
      create: { id: 'global', ...input, theme: input.theme },
    });
    await logActivity(u.id, 'Settings updated', `${s.companyName} Â· ${s.currency} Â· ${s.timezone}`);
    revalidatePath('/workspace/settings');
    revalidatePath('/workspace');
    return okRes('Settings saved.');
  } catch (e) {
    return fail(e);
  }
}

/* ------------------------------ FILES ------------------------------ */

export async function deleteFile(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const id = z.string().min(1).parse(raw);
    const asset = await db.fileAsset.findUnique({ where: { id } });
    if (!asset) return { ok: false, error: 'File not found.' };

    try {
      const fs = await import('fs');
      const path = await import('path');
      const localPath = path.join(process.cwd(), 'uploads', asset.storageKey);
      await fs.promises.unlink(localPath);
    } catch {
      /* file may live in remote storage */
    }

    await db.fileAsset.delete({ where: { id } });
    await logActivity(u.id, 'File deleted', asset.name);
    revalidatePath('/workspace/files');
    return okRes('File deleted.');
  } catch (e) {
    return fail(e);
  }
}

/* ---------------------------- TEMPLATES ----------------------------- */

export async function useTemplate(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = templateUseSchema.parse(raw);
    const template = await db.template.findUnique({ where: { id: input.templateId } });
    if (!template) return { ok: false, error: 'Template not found.' };

    const project = await db.project.create({
      data: {
        name: input.name,
        clientName: input.clientName,
        service: template.name,
        status: 'PLANNING' as ProjectStatus,
        progress: 0,
        dueDate: input.dueDate,
        ownerId: u.id,
        budget: input.budget,
      },
    });
    if (template.steps.length > 0) {
      await db.task.createMany({
        data: template.steps.map((step) => ({
          title: step,
          projectId: project.id,
          assigneeId: u.id,
          priority: 'MEDIUM' as TaskPriority,
          status: 'TODO' as TaskStatus,
        })),
      });
    }
    await logActivity(u.id, 'Project created from template', `${project.name} (${template.name})`);
    revalidatePath('/workspace/projects');
    revalidatePath('/workspace/tasks');
    return okRes('Project + starter tasks created.');
  } catch (e) {
    return fail(e);
  }
}


/* ================= PHASE 1 ï¿½ NOTIFICATIONS + HANDOVERS ================= */

export async function notify(userId: string, type: string, title: string, body?: string, link?: string) {
  await db.notification.create({ data: { userId, type, title, body: body ?? null, link: link ?? null } });
}

const taskCardSelect = {
  id: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  startDate: true,
  dueDate: true,
  completedAt: true,
  eligibleForHandover: true,
  projectId: true,
  project: { select: { name: true } },
  assigneeId: true,
  assignee: { select: { name: true } },
  originalOwnerId: true,
  originalOwner: { select: { name: true } },
  createdById: true,
  createdBy: { select: { name: true } },
} as const;

export async function markNotificationsRead(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = notificationReadSchema.parse(raw);
    const where = input.all
      ? { userId: u.id, readAt: null }
      : { userId: u.id, id: input.id, readAt: null };
    await db.notification.updateMany({ where, data: { readAt: new Date() } });
    revalidatePath('/workspace');
    revalidatePath('/workspace/notifications');
    return okRes(input.all ? 'All notifications marked read.' : 'Marked as read.');
  } catch (e) {
    return fail(e);
  }
}

export async function toggleTaskEligibility(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = taskEligibilitySchema.parse(raw);
    const task = await db.task.findUnique({ where: { id: input.taskId }, select: taskCardSelect });
    if (!task) return { ok: false, error: 'Task not found.' };
    if (u.id !== task.assigneeId && u.id !== task.createdById && u.role !== 'ADMIN') {
      return { ok: false, error: 'Only the assignee or an admin can change handover eligibility.' };
    }
    await db.task.update({ where: { id: task.id }, data: { eligibleForHandover: input.eligible } });
    await logActivity(u.id, input.eligible ? 'Task offered for assistance' : 'Handover offer removed', task.title);
    revalidatePath('/workspace/tasks');
    revalidatePath('/workspace/tasks/team');
    return okRes(input.eligible ? 'Task is now visible in Team Tasks.' : 'Task hidden from Team Tasks.');
  } catch (e) {
    return fail(e);
  }
}

export async function completeTask(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = z.object({ taskId: z.string().min(1) }).parse(raw);
    const task = await db.task.findUnique({ where: { id: input.taskId }, select: taskCardSelect });
    if (!task) return { ok: false, error: 'Task not found.' };
    if (u.id !== task.assigneeId && u.id !== task.createdById && u.role !== 'ADMIN') {
      return { ok: false, error: 'Not authorized to complete this task.' };
    }
    // A task cannot be completed while its deliverables still await review (B6).
    const openDeliverable = await db.deliverable.findFirst({
      where: { taskId: task.id, status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED'] } },
      select: { id: true, title: true },
    });
    if (openDeliverable) {
      if (u.role !== 'ADMIN') {
        return { ok: false, error: `"${openDeliverable.title}" still awaits review — resolve the deliverable before completing this task.` };
      }
      await logActivity(u.id, 'Complete override with open deliverable', `${task.title} — "${openDeliverable.title}" still open`);
    }
    await db.task.update({
      where: { id: task.id },
      data: { status: 'DONE', completedAt: new Date() },
    });
    // Resolve any pending handover requests safely.
    const penders = await db.handoverRequest.findMany({
      where: { taskId: task.id, status: 'PENDING' },
      select: { requesterId: true },
    });
    await db.handoverRequest.updateMany({
      where: { taskId: task.id, status: 'PENDING' },
      data: { status: 'REJECTED', decidedById: u.id, decidedAt: new Date() },
    });
    if (penders.length > 0 && task.assigneeId) {
      await notify(task.assigneeId, 'HANDOVER_REJECTED', `Pending handover requests on "${task.title}" were closed`, 'The task was completed.', '/workspace/tasks');
      for (const r of penders) {
        if (r.requesterId === u.id) continue;
        await mailUser(r.requesterId, () => ({
          eyebrow: 'Corble · Handover closed',
          introName: 'a task you wanted to take over has been completed.',
          message: `Requests on "${task.title}" were closed`,
          body: 'The task was marked DONE, so the pending handover requests were resolved as rejected.',
          ctaLabel: 'Open tasks →',
          ctaPath: '/workspace/tasks/team',
          footer: FOOTER,
        }));
      }
    }
    await logActivity(u.id, 'Task completed', task.title);
    revalidatePath('/workspace/tasks');
    revalidatePath('/workspace/tasks/team');
    return okRes('Task completed.');
  } catch (e) {
    return fail(e);
  }
}

export async function addTaskComment(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = taskCommentSchema.parse(raw);
    const task = await db.task.findUnique({ where: { id: input.taskId }, select: { id: true, title: true, assigneeId: true, createdById: true, originalOwnerId: true } });
    if (!task) return { ok: false, error: 'Task not found.' };
    if (task.assigneeId !== u.id && task.createdById !== u.id && task.originalOwnerId !== u.id && u.role !== 'ADMIN') {
      return { ok: false, error: 'Only people involved in this task can comment.' };
    }
    await db.taskComment.create({ data: { taskId: task.id, userId: u.id, body: input.body } });
    const watchers = [task.createdById, task.originalOwnerId].filter((id): id is string => id !== null && id !== u.id);
    for (const w of watchers) {
      await notify(w, 'TASK_COMMENT', `New comment on "${task.title}"`, input.body.slice(0, 120), '/workspace/tasks');
      await mailUser(w, () => ({
        eyebrow: 'Corble · Task comment',
        introName: `new comment on one of your tasks.`,
        message: `New comment on "${task.title}"`,
        body: input.body.slice(0, 300),
        ctaLabel: 'Open tasks →',
        ctaPath: '/workspace/tasks',
        footer: FOOTER,
      }));
    }
    revalidatePath('/workspace/tasks');
    return okRes('Comment added.');
  } catch (e) {
    return fail(e);
  }
}

export async function requestHandover(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = handoverRequestSchema.parse(raw);
    const result = await db.$transaction(async (tx) => {
      const task = await tx.task.findUnique({
        where: { id: input.taskId },
        select: { id: true, title: true, assigneeId: true, status: true, eligibleForHandover: true },
      });
      if (!task) return null;
      if (!task.assigneeId) return null;
      if (task.status === 'DONE') return null;
      if (!task.eligibleForHandover && u.role !== 'ADMIN') return null;
      if (task.assigneeId === u.id) return null;
      const dup = await tx.handoverRequest.findFirst({
        where: { taskId: task.id, requesterId: u.id, status: 'PENDING' },
      });
      if (dup) return dup;
      const other = await tx.handoverRequest.findFirst({ where: { taskId: task.id, status: 'PENDING' } });
      // Another pending request from a different member does not block visibility ï¿½ multiple members
      // may ask the same owner; owner decides. This only prevents duplicates per requester.
      const created = dup ?? (await tx.handoverRequest.create({
        data: {
          taskId: task.id,
          requesterId: u.id,
          ownerId: task.assigneeId,
          note: input.note ?? null,
        },
      }));
      await tx.notification.create({
        data: {
          userId: task.assigneeId,
          type: 'HANDOVER_REQUEST',
          title: `${u.name} requested to take over "${task.title}"`,
          body: input.note ?? null,
          link: '/workspace/tasks/team',
        },
      });
      await tx.activity.create({ data: { message: 'Handover requested', detail: `${task.title} ? ${u.name}`, userId: u.id } });
      return created;
    });
    if (!result) return { ok: false, error: 'Task is not available for handover.' };
    const created = await db.handoverRequest.findUnique({
      where: { id: result.id },
      select: { ownerId: true, task: { select: { title: true } } },
    });
    if (created?.task.title) {
      await mailUser(created.ownerId, () => ({
        eyebrow: 'Corble · Handover request',
        introName: 'a team member wants to take over one of your tasks.',
        message: `${u.name} requested to take over "${created.task.title}"`,
        body: input.note ?? null,
        ctaLabel: 'Review request →',
        ctaPath: '/workspace/tasks/team',
        footer: FOOTER,
      }));
    }
    revalidatePath('/workspace/tasks/team');
    revalidatePath('/workspace/tasks');
    return okRes('Handover request sent to the current owner.');
  } catch (e) {
    return fail(e);
  }
}

export async function decideHandover(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = handoverDecisionSchema.parse(raw);
    const approve = input.decision === 'APPROVE';
    const result = await db.$transaction(async (tx) => {
      const req = await tx.handoverRequest.findUnique({
        where: { id: input.requestId },
        include: { task: { select: taskCardSelect } },
      });
      if (!req) return { kind: 'missing' as const };
      if (req.status !== 'PENDING') return { kind: 'resolved' as const, message: 'Request already decided.' };
      // Authorization: the assignee the request targets, the task's original owner, or an admin.
      // A requester may only cancel their own pending request.
      const isOwner = req.ownerId === u.id;
      const originalOwnerId = req.task.originalOwnerId ?? null;
      const isOriginalOwner = originalOwnerId !== null && originalOwnerId === u.id;
      const isRequester = req.requesterId === u.id && input.decision === 'REJECT'; // requester action = cancel
      if (!isOwner && !isRequester && !isOriginalOwner && u.role !== 'ADMIN') {
        return { kind: 'forbidden' as const };
      }
      if (isRequester && !isOwner && u.role !== 'ADMIN') {
        const cancelled = await tx.handoverRequest.update({
          where: { id: req.id },
          data: { status: 'CANCELLED', decidedById: u.id, decidedAt: new Date() },
        });
        await tx.notification.create({
          data: { userId: req.ownerId, type: 'HANDOVER_CANCELLED', title: `${u.name} withdrew their handover request on "${req.task.title}"`, link: '/workspace/tasks' },
        });
        return { kind: 'done' as const, cancelled, message: 'Request cancelled.' };
      }
      if (approve) {
        const current = await tx.task.findUnique({ where: { id: req.taskId }, select: { assigneeId: true, originalOwnerId: true, status: true, title: true } });
        if (!current) return { kind: 'missing' as const };
        if (current.assigneeId !== req.ownerId) {
          await tx.handoverRequest.update({ where: { id: req.id }, data: { status: 'REJECTED', decidedById: u.id, decidedAt: new Date() } });
          return { kind: 'stale' as const, message: 'Task was reassigned since the request; request closed as rejected.' };
        }
        if (current.status === 'DONE') {
          await tx.handoverRequest.update({ where: { id: req.id }, data: { status: 'REJECTED', decidedById: u.id, decidedAt: new Date() } });
          return { kind: 'stale' as const, message: 'Task was completed since the request; request closed as rejected.' };
        }
        await tx.task.update({
          where: { id: req.taskId },
          data: {
            assigneeId: req.requesterId,
            // First-owner identity is preserved forever: never overwrite it with the middle owner.
            originalOwnerId: current.originalOwnerId ?? current.assigneeId,
            eligibleForHandover: false,
          },
        });
        const approved = await tx.handoverRequest.update({
          where: { id: req.id },
          data: { status: 'APPROVED', decidedById: u.id, decidedAt: new Date() },
        });
        // Keep history: requester gets confirmation, former owner gets notification.
        await tx.notification.create({
          data: { userId: req.ownerId, type: 'HANDOVER_APPROVED', title: `Handover approved: "${current.title}" now assigned to ${req.requesterId === u.id ? 'you' : req.requesterId}`, link: '/workspace/tasks/team' },
        });
        await tx.notification.create({
          data: { userId: req.requesterId, type: 'HANDOVER_APPROVED', title: `"${current.title}" is now yours`, body: 'You took over this task. Its original owner remains recorded.', link: '/workspace/tasks' },
        });
        await tx.activity.create({
          data: { message: 'Handover approved', detail: `${current.title}: ${req.ownerId} ? ${req.requesterId}`, userId: u.id },
        });
        return { kind: 'done' as const, approved, message: 'Handover approved. Task reassigned.' };
      }
      // REJECTED by owner/admin
      await tx.handoverRequest.update({ where: { id: req.id }, data: { status: 'REJECTED', decidedById: u.id, decidedAt: new Date() } });
      await tx.notification.create({
        data: { userId: req.requesterId, type: 'HANDOVER_REJECTED', title: `Your handover request on "${req.task.title}" was declined`, link: '/workspace/tasks/team' },
      });
      await tx.activity.create({ data: { message: 'Handover declined', detail: req.task.title, userId: u.id } });
      return { kind: 'done' as const, message: 'Request declined.' };
    });
    if (!result || result.kind === 'missing') return { ok: false, error: 'Request not found.' };
    if (result.kind === 'forbidden') return { ok: false, error: 'Only the task owner, its original owner, or an admin can decide this request.' };
    if (result.kind === 'resolved' || result.kind === 'stale') {
      return { ok: true, message: result.message };
    }
    if (result.kind === 'done') {
      // Email the affected parties based on the final state of the request.
      const fresh = await db.handoverRequest.findUnique({
        where: { id: input.requestId },
        select: { status: true, ownerId: true, requesterId: true, task: { select: { title: true } } },
      });
      if (fresh?.task.title) {
        const title = fresh.task.title;
        if (fresh.status === 'CANCELLED') {
          await mailUser(fresh.ownerId, ({ name }) => ({
            eyebrow: 'Corble · Handover request',
            introName: `a handover request on your task was withdrawn by the requester.`,
            message: `${u.name} withdrew their handover request on "${title}"`,
            body: null,
            ctaLabel: 'Open tasks →',
            ctaPath: '/workspace/tasks',
            footer: FOOTER,
          }));
        } else if (fresh.status === 'APPROVED') {
          await Promise.all([
            mailUser(fresh.ownerId, () => ({
              eyebrow: 'Corble · Handover approved',
              introName: 'a handover request on your task was approved.',
              message: `Handover approved: "${title}" is now assigned to ${fresh.requesterId}`,
              body: 'The task was transferred. Your original ownership stays recorded in task history.',
              ctaLabel: 'Open team tasks →',
              ctaPath: '/workspace/tasks/team',
              footer: FOOTER,
            })),
            mailUser(fresh.requesterId, () => ({
              eyebrow: 'Corble · Handover approved',
              introName: 'your handover request was approved — the task is yours now.',
              message: `"${title}" is now yours`,
              body: 'You took over this task. Its original owner remains recorded.',
              ctaLabel: 'Open my tasks →',
              ctaPath: '/workspace/tasks',
              footer: FOOTER,
            })),
          ]);
        } else if (fresh.status === 'REJECTED') {
          await mailUser(fresh.requesterId, () => ({
            eyebrow: 'Corble · Handover declined',
            introName: 'your handover request was declined by the task owner.',
            message: `Your handover request on "${title}" was declined`,
            body: null,
            ctaLabel: 'Open team tasks →',
            ctaPath: '/workspace/tasks/team',
            footer: FOOTER,
          }));
        }
      }
    }
    revalidatePath('/workspace/tasks/team');
    revalidatePath('/workspace/tasks');
    revalidatePath('/workspace/notifications');
    return okRes('message' in result && typeof result.message === 'string' ? result.message : 'Done.');
  } catch (e) {
    return fail(e);
  }
}

/* ================= PHASE 2 ï¿½ DELIVERABLES ================= */

export async function submitDeliverable(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = deliverableSchema.parse(raw);

    let attachTask: { id: string; title: string; assigneeId: string | null; createdById: string | null; projectId: string | null } | null = null;
    let attachPhase: { id: string; title: string; ownerId: string | null; project: { id: string; ownerId: string | null; name: string } } | null = null;
    if (input.taskId) {
      const task = await db.task.findUnique({
        where: { id: input.taskId },
        select: { id: true, title: true, assigneeId: true, createdById: true, projectId: true },
      });
      if (!task) return { ok: false, error: 'Task not found.' };
      if (u.id !== task.assigneeId && u.id !== task.createdById && u.role !== 'ADMIN') {
        return { ok: false, error: 'Only the assignee (or creator) can submit work for this task.' };
      }
      attachTask = task;
    } else if (input.phaseId) {
      const phase = await db.automationPhase.findUnique({
        where: { id: input.phaseId },
        select: { id: true, title: true, ownerId: true, project: { select: { id: true, ownerId: true, name: true } } },
      });
      if (!phase) return { ok: false, error: 'Automation phase not found.' };
      if (u.id !== phase.ownerId && u.id !== phase.project.ownerId && u.role !== 'ADMIN') {
        return { ok: false, error: 'Only the phase owner (or project owner) can submit work for this phase.' };
      }
      attachPhase = phase;
    } else {
      return { ok: false, error: 'Attach the deliverable to a task or an automation phase.' };
    }

    const deliverable = await db.deliverable.create({
      data: {
        title: input.title,
        taskId: attachTask?.id ?? null,
        projectId: attachTask?.projectId ?? null,
        phaseId: attachPhase?.id ?? null,
        status: 'UNDER_REVIEW',
        createdById: u.id,
        versions: {
          create: {
            version: 1,
            body: input.body,
            externalUrl: input.externalUrl ?? null,
            fileId: input.fileId ?? null,
            status: 'UNDER_REVIEW',
            submittedById: u.id,
          },
        },
      },
    });
    if (attachTask) {
      if (attachTask.createdById && attachTask.createdById !== u.id) {
        await notify(attachTask.createdById, 'DELIVERABLE_SUBMITTED', `Deliverable submitted for "${attachTask.title}"`, input.title, '/workspace/deliverables');
        await mailUser(attachTask.createdById, () => ({
          eyebrow: 'Corble · Deliverable review',
          introName: 'a deliverable was submitted and is waiting for your review.',
          message: `Deliverable submitted for "${attachTask.title}"`,
          body: `${input.title}${input.externalUrl ? ` — Link: ${input.externalUrl}` : ''}`,
          ctaLabel: 'Review deliverables →',
          ctaPath: '/workspace/deliverables',
          footer: FOOTER,
        }));
      } else if (attachTask.projectId) {
        const admin = await db.user.findFirst({ where: { role: 'ADMIN', isActive: true } });
        if (admin && admin.id !== u.id) {
          await notify(admin.id, 'DELIVERABLE_SUBMITTED', `Deliverable submitted for "${attachTask.title}"`, input.title, '/workspace/deliverables');
          await mailUser(admin.id, () => ({
            eyebrow: 'Corble · Deliverable review',
            introName: 'a deliverable was submitted and is waiting for your review.',
            message: `Deliverable submitted for "${attachTask.title}"`,
            body: `${input.title}${input.externalUrl ? ` — Link: ${input.externalUrl}` : ''}`,
            ctaLabel: 'Review deliverables →',
            ctaPath: '/workspace/deliverables',
            footer: FOOTER,
          }));
        }
      }
    }
    if (attachPhase) {
      const reviewerId = attachPhase.ownerId ?? attachPhase.project.ownerId;
      if (reviewerId && reviewerId !== u.id) {
        await notify(reviewerId, 'DELIVERABLE_SUBMITTED', `Deliverable submitted for phase "${attachPhase.title}"`, input.title, `/workspace/automation/${attachPhase.project.id}`);
        await mailUser(reviewerId, () => ({
          eyebrow: 'Corble · Deliverable review',
          introName: 'a deliverable was submitted for an automation phase and is waiting for your review.',
          message: `Deliverable submitted for phase "${attachPhase.title}"`,
          body: `${input.title} — ${attachPhase.project.name}${input.externalUrl ? ` — Link: ${input.externalUrl}` : ''}`,
          ctaLabel: 'Review deliverables →',
          ctaPath: '/workspace/deliverables',
          footer: FOOTER,
        }));
      }
    }
    await logActivity(u.id, 'Deliverable submitted', `${input.title} (${attachTask?.title ?? attachPhase?.title ?? ''})`);
    revalidatePath('/workspace/deliverables');
    revalidatePath('/workspace/tasks');
    return okRes('Deliverable submitted for review.');
  } catch (e) {
    return fail(e);
  }
}

export async function submitNewVersion(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = deliverableVersionSchema.parse(raw);
    const old = await db.deliverable.findUnique({
      where: { id: input.id },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!old) {
      return { ok: false, error: 'Deliverable not found.' };
    }
    if (old.createdById !== u.id && u.role !== 'ADMIN') {
      return { ok: false, error: 'Only the submitter (or an admin) can add versions.' };
    }
    const nextVersion = (old.versions[0]?.version ?? 0) + 1;
    await db.deliverable.update({
      where: { id: old.id },
      data: {
        status: 'UNDER_REVIEW',
        currentVersion: nextVersion,
        versions: {
          create: {
            version: nextVersion,
            body: input.body,
            externalUrl: input.externalUrl ?? null,
            fileId: input.fileId ?? null,
            status: 'UNDER_REVIEW',
            submittedById: u.id,
          },
        },
      },
    });
    await logActivity(u.id, 'Deliverable version submitted', `${old.title} v${nextVersion}`);
    revalidatePath('/workspace/deliverables');
    return okRes(`Version ${nextVersion} submitted.`);
  } catch (e) {
    return fail(e);
  }
}

export async function reviewDeliverable(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = deliverableReviewSchema.parse(raw);
    const version = await db.deliverableVersion.findUnique({
      where: { id: input.versionId },
      include: { deliverable: { select: { id: true, title: true, createdById: true, taskId: true } } },
    });
    if (!version) return { ok: false, error: 'Version not found.' };
    if (version.submittedById === u.id && u.role !== 'ADMIN') {
      return { ok: false, error: 'You cannot review your own submission.' };
    }
    if (version.submittedById === u.id && u.role === 'ADMIN') {
      await logActivity(u.id, 'Self-review override (deliverable)', `${version.deliverable.title} v${version.version} — reviewed own submission as admin`);
    }
    await db.$transaction(async (tx) => {
      await tx.deliverableVersion.update({ where: { id: version.id }, data: { status: input.decision } });
      await tx.deliverable.update({ where: { id: version.deliverableId }, data: { status: input.decision, currentVersion: version.version } });
      await tx.deliverableReview.create({
        data: { versionId: version.id, decision: input.decision, comment: input.comment, reviewerId: u.id },
      });
    });
    await logActivity(u.id, `Deliverable ${input.decision.toLowerCase().replace('_', ' ')}`, `${version.deliverable.title} v${version.version}`);
    if (version.deliverable.createdById && version.deliverable.createdById !== u.id) {
      await notify(
        version.deliverable.createdById,
        input.decision === 'APPROVED' ? 'DELIVERABLE_APPROVED' : 'DELIVERABLE_CHANGES',
        `Review result: ${input.decision.replace('_', ' ').toLowerCase()} — ${version.deliverable.title}`,
        input.comment,
        '/workspace/deliverables'
      );
      await mailUser(version.deliverable.createdById, () => ({
        eyebrow: 'Corble · Deliverable review',
        introName: 'your submitted work was reviewed.',
        message: `${version.deliverable.title} v${version.version}: ${input.decision.replace('_', ' ').toLowerCase()}`,
        body: input.comment,
        ctaLabel: 'Open deliverables →',
        ctaPath: '/workspace/deliverables',
        footer: FOOTER,
      }));
    }
    revalidatePath('/workspace/deliverables');
    return okRes('Review recorded.');
  } catch (e) {
    return fail(e);
  }
}

/* ================= PHASE 3 ï¿½ INCOMING LEADS PIPELINE ================= */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function domainOf(value: string | null | undefined): string | null {
  if (!value) return null;
  let v = value.trim().toLowerCase();
  if (v.includes('@')) v = v.split('@')[1];
  v = v.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) return null;
  return v;
}

export async function runVerification(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = verifyActionSchema.parse(raw);
    const lead = await db.incomingLead.findUnique({ where: { id: input.leadId } });
    if (!lead) return { ok: false, error: 'Lead not found.' };

    let result: 'SYNTAX_VALIDATED' | 'DOMAIN_CHECKED' | 'WEBSITE_REACHABLE' | 'CONTACT_VERIFIED' | 'INVALID' | 'VERIFICATION_FAILED' | 'MANUALLY_REVIEWED' = 'MANUALLY_REVIEWED';
    let detail: string | null = null;
    let method = input.method;

    if (input.method === 'EMAIL_SYNTAX') {
      method = 'EMAIL_SYNTAX';
      if (!lead.email) return { ok: false, error: 'No email on this lead.' };
      const valid = EMAIL_RE.test(lead.email);
      result = valid ? 'SYNTAX_VALIDATED' : 'INVALID';
      detail = valid ? 'Syntax OK (does not prove the mailbox exists)' : 'Invalid email syntax';
    } else if (input.method === 'DOMAIN_DNS') {
      method = 'DOMAIN_DNS';
      const domain = domainOf(lead.website) ?? domainFromEmail(lead.email) ?? lead.domain;
      if (!domain) return { ok: false, error: 'No website, email or domain to check.' };
      const ok = await dnsLookup(domain);
      result = ok ? 'DOMAIN_CHECKED' : 'VERIFICATION_FAILED';
      detail = ok ? `DNS resolved for ${domain} (domain exists; not proof of validity)` : `DNS lookup failed for ${domain}`;
    } else if (input.method === 'WEBSITE_FETCH') {
      method = 'WEBSITE_FETCH';
      const url = lead.website?.startsWith('http') ? lead.website : lead.website ? `https://${lead.website}` : null;
      if (!url) return { ok: false, error: 'No website URL on this lead.' };
      try {
        // SSRF-guarded fetch (D7): private/localhost/metadata targets and redirects
        // into them are blocked; 8s deadline + 2MB response cap.
        const out = await safeFetch(url, { timeoutMs: 8000, maxBytes: 2_000_000 });
        result = out.ok ? 'WEBSITE_REACHABLE' : 'VERIFICATION_FAILED';
        detail = out.aborted
          ? `Request to ${out.finalHost} timed out or hit the redirect/size guard (8s)`
          : `${out.ok ? 'Reached' : `HTTP ${out.status}`} ${out.finalHost} (${(out.bytes / 1024).toFixed(0)}KB) — reachability is not proof of relevance`;
      } catch (err) {
        result = 'VERIFICATION_FAILED';
        const why = err instanceof Error ? err.message.replace(/^Blocked: /, 'Blocked — ') : 'request failed';
        detail = `Request to ${url} refused: ${why}`;
      }
    } else {
      method = 'MANUAL_REVIEW';
      result = 'MANUALLY_REVIEWED';
      detail = `Manually reviewed by ${u.name}`;
    }

    // Manual review of a healthy record is the strongest actual check.
    const newStatus =
      input.method === 'MANUAL_REVIEW'
        ? 'MANUALLY_REVIEWED'
        : lead.verification === 'MANUALLY_REVIEWED'
          ? lead.verification
          : result;

    await db.$transaction(async (tx) => {
      await tx.leadVerificationCheck.create({
        data: { leadId: lead.id, method, result, detail, checkedById: u.id },
      });
      await tx.incomingLead.update({ where: { id: lead.id }, data: { verification: newStatus } });
      await tx.activity.create({ data: { message: 'Lead verification run', detail: `${lead.company}: ${method} ? ${result}`, userId: u.id } });
    });
    revalidatePath('/workspace/leads/incoming');
    return okRes(`Check recorded: ${result.replace(/_/g, ' ').toLowerCase()}. ${detail ?? ''}`.trim());
  } catch (e) {
    return fail(e);
  }
}

async function dnsLookup(domain: string): Promise<boolean> {
  const dns = await import('dns');
  return new Promise((resolve) => {
    dns.promises
      .resolveCname(domain)
      .then(() => resolve(true))
      .catch(() =>
        dns.promises
          .resolve(domain)
          .then(() => resolve(true))
          .catch(() => resolve(false))
      );
  });
}

export async function addResearch(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = researchUpdateSchema.parse(raw);
    const lead = await db.incomingLead.findUnique({ where: { id: input.leadId }, select: { id: true, company: true, enrichment: true, processingStatus: true, researchNotes: true } });
    if (!lead) return { ok: false, error: 'Lead not found.' };
    if (lead.processingStatus === 'REJECTED') return { ok: false, error: 'Lead was rejected ï¿½ restore it first.' };
    await db.$transaction(async (tx) => {
      await tx.leadResearchUpdate.create({ data: { leadId: lead.id, authorId: u.id, body: input.body, sourceUrl: input.sourceUrl ?? null } });
      const existing = (lead.enrichment as { research?: string[] } | null)?.research ?? [];
      await tx.incomingLead.update({
        where: { id: lead.id },
        data: {
          enrichment: { ...(lead.enrichment as object | null), research: [...existing, { by: u.name, at: new Date().toISOString(), note: input.body, url: input.sourceUrl ?? null }] },
          processingStatus: lead.processingStatus === 'NEW' ? 'UNDER_REVIEW' : undefined,
          researchNotes: [...(lead.researchNotes ?? ''), `[${new Date().toISOString()}] ${u.name}: ${input.body}`].filter(Boolean).join('\n'),
        },
      });
      await tx.activity.create({ data: { message: 'Lead research added', detail: lead.company, userId: u.id } });
    });
    revalidatePath('/workspace/leads/incoming');
    return okRes('Research note recorded.');
  } catch (e) {
    return fail(e);
  }
}

export async function rejectIncoming(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = z.object({ incomingId: z.string().min(1), restore: z.boolean().optional() }).parse(raw);
    const lead = await db.incomingLead.findUnique({ where: { id: input.incomingId }, select: { id: true, company: true, processingStatus: true } });
    if (!lead) return { ok: false, error: 'Lead not found.' };
    if (lead.processingStatus === 'PROMOTED') return { ok: false, error: 'Already promoted ï¿½ cannot reject.' };
    await db.incomingLead.update({
      where: { id: lead.id },
      data: { processingStatus: input.restore ? 'UNDER_REVIEW' : 'REJECTED', reviewedById: u.id },
    });
    await logActivity(u.id, input.restore ? 'Lead restored for review' : 'Lead rejected', lead.company);
    revalidatePath('/workspace/leads/incoming');
    return okRes(input.restore ? 'Lead restored.' : 'Lead marked rejected.');
  } catch (e) {
    return fail(e);
  }
}

export async function bulkRejectIncoming(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const ids = z.array(z.string().min(1)).min(1).parse(raw);
    const skipped = { promoted: 0, rejected: 0 };
    let n = 0;
    for (const id of ids) {
      const lead = await db.incomingLead.findUnique({ where: { id }, select: { processingStatus: true } });
      if (!lead || lead.processingStatus === 'PROMOTED') skipped.promoted++;
      else if (lead.processingStatus === 'REJECTED') skipped.rejected++;
      else {
        await db.incomingLead.update({ where: { id }, data: { processingStatus: 'REJECTED', reviewedById: u.id } });
        n++;
      }
    }
    await logActivity(u.id, 'Leads bulk-rejected', `${n} rejected (skipped: ${skipped.promoted} promoted, ${skipped.rejected} already rejected)`);
    revalidatePath('/workspace/leads/incoming');
    const parts = [`Rejected ${n}.`];
    if (skipped.promoted) parts.push(`${skipped.promoted} skipped (promoted).`);
    if (skipped.rejected) parts.push(`${skipped.rejected} already rejected.`);
    return okRes(parts.join(' '));
  } catch (e) {
    return fail(e);
  }
}

export async function deleteIncoming(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const id = z.string().min(1).parse(raw);
    const lead = await db.incomingLead.findUnique({ where: { id }, select: { company: true, processingStatus: true } });
    if (!lead) return { ok: false, error: 'Incoming lead not found.' };
    if (lead.processingStatus === 'PROMOTED') return { ok: false, error: 'Already promoted — delete the final lead instead.' };
    await db.incomingLead.delete({ where: { id } });
    await logActivity(u.id, 'Incoming lead deleted', lead.company);
    revalidatePath('/workspace/leads/incoming');
    revalidatePath('/workspace');
    return okRes('Incoming lead deleted.');
  } catch (e) {
    return fail(e);
  }
}

export async function bulkDeleteIncoming(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const ids = z.array(z.string().min(1)).min(1).parse(raw);
    let skipped = 0;
    for (const id of ids) {
      const lead = await db.incomingLead.findUnique({ where: { id }, select: { processingStatus: true } });
      if (!lead || lead.processingStatus === 'PROMOTED') {
        skipped++;
        continue;
      }
      await db.incomingLead.delete({ where: { id } });
    }
    const n = ids.length - skipped;
    await logActivity(u.id, 'Incoming leads bulk-deleted', `${n} deleted (skipped: ${skipped} promoted)`);
    revalidatePath('/workspace/leads/incoming');
    revalidatePath('/workspace');
    return okRes(n ? `${n} incoming lead${n === 1 ? '' : 's'} deleted.${skipped ? ` ${skipped} skipped (promoted).` : ''}` : 'Nothing deleted — all selected were promoted.');
  } catch (e) {
    return fail(e);
  }
}

export async function promoteToFinal(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = promoteLeadSchema.parse(raw);
    const out = await db.$transaction(async (tx) => {
      const lead = await tx.incomingLead.findUnique({ where: { id: input.incomingId } });
      if (!lead) return { code: 'missing' as const };
      if (lead.processingStatus === 'PROMOTED' && lead.finalLeadId) {
        return { code: 'already' as const, id: lead.finalLeadId, existing: true };
      }
      if (lead.processingStatus === 'REJECTED') return { code: 'rejected' as const };
      // Validation: needs at least a company (already) and one contact channel.
      if (!lead.email && !lead.phone && !lead.website) return { code: 'nocontact' as const };
      // Verification gate (D3): at least one meaningful check must have completed
      // (manual review is the strongest). Admins may override, and it is logged.
      const verifiedEnough =
        lead.verification === 'SYNTAX_VALIDATED' ||
        lead.verification === 'DOMAIN_CHECKED' ||
        lead.verification === 'WEBSITE_REACHABLE' ||
        lead.verification === 'CONTACT_VERIFIED' ||
        lead.verification === 'MANUALLY_REVIEWED';
      if (!verifiedEnough) {
        if (u.role === 'ADMIN') {
          await tx.activity.create({
            data: { message: 'Promote override (unverified)', detail: `${lead.company}: promoted at "${lead.verification}" by ${u.name}`, userId: u.id },
          });
        } else {
          return { code: 'unverified' as const, level: lead.verification };
        }
      }

      // Duplicate detection against FINAL records. Domain from a free-mail email is
      // not a company domain — never use it (D1).
      const domain = domainOf(lead.website) ?? domainFromEmail(lead.email) ?? lead.domain;
      const clash = await tx.lead.findFirst({
        where: {
          OR: [
            ...(lead.email ? [{ email: lead.email }] : []),
            ...(domain ? [{ name: { equals: lead.company, mode: 'insensitive' as const } }] : []),
          ],
        },
      });
      if (clash) return { code: 'dupfinal' as const, id: clash.id, name: clash.name };

      // Duplicate within INCOMING pool (same email from a different source).
      if (lead.email) {
        const other = await tx.incomingLead.findFirst({
          where: { id: { not: lead.id }, email: lead.email, processingStatus: 'PROMOTED' },
          select: { id: true, finalLeadId: true },
        });
        if (other?.finalLeadId) return { code: 'dupfinal' as const, id: other.finalLeadId, name: lead.company };
      }

      const final = await tx.lead.create({
        data: {
          name: input.overrideCompany?.trim() || lead.company,
          leadCode: lead.leadCode,
          contactPerson: lead.contactPerson,
          email: lead.email,
          phone: lead.phone,
          website: lead.website,
          industry: lead.industry,
          city: lead.city,
          country: lead.country,
          service: lead.industry ?? 'General enquiry',
          notes: `Promoted from Incoming Lead ${lead.id} (source: ${lead.source}${lead.sourceUrl ? `, ${lead.sourceUrl}` : ''}). ${lead.researchNotes ? 'Research: ' + lead.researchNotes : ''}`.slice(0, 1900),
          source: `Incoming ï¿½ ${lead.source}`,
          status: 'NEW',
          estValue: input.estValue,
          ownerId: u.id,
        },
      });
      await tx.incomingLead.update({
        where: { id: lead.id },
        data: { processingStatus: 'PROMOTED', finalLeadId: final.id, reviewedById: u.id },
      });
      await tx.activity.create({ data: { message: 'Lead promoted to Final', detail: `${lead.company} ? ${final.name}`, userId: u.id } });
      return { code: 'ok' as const, id: final.id, name: final.name };
    });
    if (!out || out.code === 'missing') return { ok: false, error: 'Incoming lead not found.' };
    if (out.code === 'rejected') return { ok: false, error: 'Lead was rejected. Restore it first.' };
    if (out.code === 'unverified') {
      return { ok: false, error: `Verification level "${out.level === 'UNVERIFIED' ? 'unverified' : out.level}" is too low to promote — run a check first (or use an admin override).` };
    }
    if (out.code === 'nocontact') return { ok: false, error: 'Lead has no email, phone or website — verify or research it first.' };
    if (out.code === 'dupfinal') {
      return { ok: false, error: `A final lead already matches this record (see "${'name' in out && out.name ? out.name : 'existing'}"). Review before promoting.`, message: 'conflict' };
    }
    if (out.code === 'already') {
      return { ok: true, message: `Already promoted earlier ï¿½ final lead ${out.id}.` };
    }
    revalidatePath('/workspace/leads/incoming');
    revalidatePath('/workspace/leads');
    return okRes(`Promoted! Final lead created (${out.id}).`);
  } catch (e) {
    return fail(e);
  }
}

/* ================= PHASE 5 ï¿½ AUTOMATION PROJECTS ================= */

export async function createAutomation(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = automationSchema.parse(raw);
    const p = await db.automationProject.create({
      data: {
        name: input.name,
        description: input.description,
        ownerId: u.id,
        maintainerId: input.maintainerId ?? null,
        githubRepo: input.githubRepo ?? null,
        websiteProjectId: input.websiteProjectId ?? null,
      },
    });
    await logActivity(u.id, 'Automation project created', p.name);
    revalidatePath('/workspace/automation');
    return okRes('Automation project created.');
  } catch (e) {
    return fail(e);
  }
}

function nextStatusFor(current: string, decision: string): 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED_FOR_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'BLOCKED' {
  if (decision === 'APPROVED') return 'APPROVED';
  if (decision === 'CHANGES_REQUESTED') return 'CHANGES_REQUESTED';
  return 'SUBMITTED_FOR_REVIEW';
}

function progressOf(phases: { status: string }[]): number {
  if (phases.length === 0) return 0;
  const approved = phases.filter((p) => p.status === 'APPROVED').length;
  const reviewing = phases.filter((p) => p.status === 'SUBMITTED_FOR_REVIEW' || p.status === 'CHANGES_REQUESTED').length;
  return Math.round(((approved + reviewing * 0.5) / phases.length) * 100);
}

export async function addPhase(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = phaseSchema.parse(raw);
    const project = await db.automationProject.findUnique({ where: { id: input.projectId }, select: { id: true, ownerId: true } });
    if (!project) return { ok: false, error: 'Automation project not found.' };
    if (u.id !== project.ownerId && u.role !== 'ADMIN') return { ok: false, error: 'Only the project owner (or an admin) can define phases.' };
    if (input.dependsOnId) {
      const dep = await db.automationPhase.findFirst({ where: { id: input.dependsOnId, projectId: input.projectId } });
      if (!dep) return { ok: false, error: 'Dependency must be a phase of the same project.' };
    }
    const count = await db.automationPhase.count({ where: { projectId: input.projectId } });
    const phase = await db.automationPhase.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        order: count + 1,
        ownerId: input.ownerId ?? u.id,
        dueDate: input.dueDate ?? null,
        dependsOnId: input.dependsOnId ?? null,
      },
    });
    await logActivity(u.id, 'Automation phase added', `${input.title} (#${phase.order})`);
    revalidatePath(`/workspace/automation/${input.projectId}`);
    return okRes('Phase added.');
  } catch (e) {
    return fail(e);
  }
}

export async function submitPhase(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = phaseSubmitSchema.parse(raw);
    const phase = await db.automationPhase.findUnique({
      where: { id: input.phaseId },
      include: { project: { select: { ownerId: true, status: true } }, dependsOn: { select: { status: true, title: true } } },
    });
    if (!phase) return { ok: false, error: 'Phase not found.' };
    if (u.id !== phase.ownerId && u.id !== phase.project.ownerId && u.role !== 'ADMIN') {
      return { ok: false, error: 'Only the phase owner (or project owner) can submit.' };
    }
    if (phase.dependsOn && phase.dependsOn.status !== 'APPROVED') {
      return { ok: false, error: `Phase "${phase.dependsOn.title}" must be approved first ï¿½ its prerequisite is not satisfied.` };
    }
    if (phase.status === 'APPROVED') return { ok: false, error: 'Phase is already approved. Add a new phase instead.' };
    const lastVersion = await db.phaseSubmission.findFirst({ where: { phaseId: phase.id }, orderBy: { version: 'desc' } });
    const version = (lastVersion?.version ?? 0) + 1;
    const reviewerAdmin = await db.user.findFirst({ where: { role: 'ADMIN', isActive: true } });
    await db.$transaction(async (tx) => {
      await tx.phaseSubmission.create({ data: { phaseId: phase.id, version, notes: input.notes, authorId: u.id } });
      await tx.automationPhase.update({ where: { id: phase.id }, data: { status: 'SUBMITTED_FOR_REVIEW' } });
      await tx.automationProject.update({ where: { id: phase.projectId }, data: { status: phase.project.status === 'PLANNING' ? 'IN_PROGRESS' : undefined } });
    });
    if (reviewerAdmin) {
      await notify(reviewerAdmin.id, 'PHASE_SUBMITTED', `Phase "${phase.title}" v${version} submitted for review`, input.notes.slice(0, 160), `/workspace/automation/${phase.projectId}`);
      if (reviewerAdmin.id !== u.id) {
        await mailUser(reviewerAdmin.id, () => ({
          eyebrow: 'Corble · Automation phase',
          introName: 'a phase was submitted for your review.',
          message: `Phase "${phase.title}" v${version} submitted for review`,
          body: input.notes.slice(0, 300),
          ctaLabel: 'Review phase →',
          ctaPath: `/workspace/automation/${phase.projectId}`,
          footer: FOOTER,
        }));
      }
    }
    await logActivity(u.id, 'Phase submitted for review', `${phase.title} v${version}`);
    revalidatePath(`/workspace/automation/${phase.projectId}`);
    revalidatePath('/workspace');
    return okRes(`Version ${version} submitted for review.`);
  } catch (e) {
    return fail(e);
  }
}

export async function reviewPhase(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = phaseReviewSchema.parse(raw);
    const submission = await db.phaseSubmission.findUnique({
      where: { id: input.submissionId },
      include: { phase: { select: { id: true, title: true, projectId: true, order: true } } },
    });
    if (!submission) return { ok: false, error: 'Submission not found.' };
    if (submission.authorId === u.id && u.role !== 'ADMIN') return { ok: false, error: 'You cannot review your own phase submission.' };
    if (submission.authorId === u.id && u.role === 'ADMIN') {
      await logActivity(u.id, 'Self-review override (phase)', `${submission.phase.title} v${submission.version} — reviewed own submission as admin`);
    }
    const approved = input.decision === 'APPROVED';
    await db.$transaction(async (tx) => {
      await tx.phaseSubmission.update({
        where: { id: submission.id },
        data: { status: approved ? 'approved' : 'changes_requested', reviewerId: u.id, reviewComment: input.comment ?? null, reviewedAt: new Date() },
      });
      await tx.automationPhase.update({
        where: { id: submission.phaseId },
        data: {
          status: nextStatusFor(submission.status, input.decision),
          completedAt: approved ? new Date() : null,
        },
      });
    });
    if (submission.authorId) {
      await db.notification.create({ data: { userId: submission.authorId, type: 'PHASE_REVIEWED', title: `Phase "${submission.phase.title}" v${submission.version}: ${approved ? 'approved' : 'changes requested'}`, body: input.comment ?? null, link: `/workspace/automation/${submission.phase.projectId}` } });
      if (submission.authorId !== u.id) {
        await mailUser(submission.authorId, () => ({
          eyebrow: 'Corble · Automation phase',
          introName: 'a phase submission you authored was reviewed.',
          message: `Phase "${submission.phase.title}" v${submission.version}: ${approved ? 'approved' : 'changes requested'}`,
          body: input.comment ?? null,
          ctaLabel: 'Open automation →',
          ctaPath: `/workspace/automation/${submission.phase.projectId}`,
          footer: FOOTER,
        }));
      }
    }
    await logActivity(u.id, approved ? 'Phase approved' : 'Phase changes requested', `${submission.phase.title} v${submission.version}`);
    revalidatePath(`/workspace/automation/${submission.phase.projectId}`);
    return okRes(approved ? 'Phase approved ï¿½ dependent phases may now proceed.' : 'Changes requested.');
  } catch (e) {
    return fail(e);
  }
}

export async function assembleDelivery(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = finalDeliverySchema.parse(raw);
    const project = await db.automationProject.findUnique({
      where: { id: input.projectId },
      include: { phases: { select: { title: true, status: true, order: true } } },
    });
    if (!project) return { ok: false, error: 'Project not found.' };
    if (u.id !== project.ownerId && u.role !== 'ADMIN') return { ok: false, error: 'Only the project owner (or an admin) can assemble the final delivery.' };
    if (project.phases.some((p) => p.status === 'SUBMITTED_FOR_REVIEW' || p.status === 'CHANGES_REQUESTED')) {
      return { ok: false, error: 'All phases must be resolved (approved or explicitly not required) before delivery.' };
    }
    if (project.phases.length > 0 && project.phases.filter((p) => p.status === 'APPROVED').length === 0) {
      return { ok: false, error: 'No approved phases to deliver.' };
    }
    const requiredCount = project.phases.length;
    const approvedCount = project.phases.filter((p) => p.status === 'APPROVED').length;
    await db.automationProject.update({
      where: { id: project.id },
      data: {
        finalDelivery: {
          pending: true,
          assembledById: u.id,
          assembledAt: new Date().toISOString(),
          repoUrl: input.repoUrl ?? null,
          websiteUrl: input.websiteUrl ?? null,
          notes: input.notes ?? null,
          phasesTotal: requiredCount,
          phasesApproved: approvedCount,
        },
      },
    });
    if (project.deliveryAcceptedById !== u.id && project.ownerId && project.ownerId !== u.id) {
      await db.notification.create({ data: { userId: project.ownerId, type: 'DELIVERY_PENDING', title: `Final delivery assembled for "${project.name}" — awaiting acceptance`, link: `/workspace/automation/${project.id}` } });
      await mailUser(project.ownerId, () => ({
        eyebrow: 'Corble · Delivery ready',
        introName: 'the final delivery of an automation project was assembled.',
        message: `Final delivery assembled for "${project.name}" — awaiting acceptance`,
        body: `${approvedCount}/${requiredCount} phases approved${input.websiteUrl ? ` · Website: ${input.websiteUrl}` : ''}${input.repoUrl ? ` · Repo: ${input.repoUrl}` : ''}${input.notes ? ` · ${input.notes}` : ''}`,
        ctaLabel: 'Review delivery →',
        ctaPath: `/workspace/automation/${project.id}`,
        footer: FOOTER,
      }));
    }
    await logActivity(u.id, 'Final delivery assembled', project.name);
    revalidatePath(`/workspace/automation/${project.id}`);
    return okRes('Delivery package assembled. It stays pending until the designated reviewer accepts it.');
  } catch (e) {
    return fail(e);
  }
}

export async function acceptDelivery(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = acceptDeliverySchema.parse(raw);
    const project = await db.automationProject.findUnique({ where: { id: input.projectId }, select: { id: true, name: true, finalDelivery: true, ownerId: true, deliveryAcceptedById: true } });
    if (!project) return { ok: false, error: 'Project not found.' };
    const pending = (project.finalDelivery as { pending?: boolean } | null)?.pending;
    if (!pending) return { ok: false, error: 'No pending delivery package.' };
    if (project.deliveryAcceptedById) return { ok: false, error: 'Delivery already accepted.' };
    if (project.ownerId === u.id && u.role !== 'ADMIN') return { ok: false, error: 'The designated reviewer must accept the delivery (project owner cannot self-accept unless admin).' };
    await db.automationProject.update({
      where: { id: project.id },
      data: {
        status: 'DELIVERED',
        deliveryAcceptedById: u.id,
        deliveryAcceptedAt: new Date(),
        finalDelivery: { pending: false, accepted: true, acceptedById: u.id, acceptedAt: new Date().toISOString() },
      },
    });
    await logActivity(u.id, 'Final delivery accepted', project.name);
    revalidatePath(`/workspace/automation/${project.id}`);
    revalidatePath('/workspace');
    return okRes('Delivery accepted and project marked DELIVERED.');
  } catch (e) {
    return fail(e);
  }
}

/* ================= PHASE 7 â€” GITHUB CONNECTIONS & DEPLOYS ================= */

export async function connectGithub(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = githubConnectSchema.parse(raw);
    if (u.role !== 'ADMIN') return { ok: false, error: 'Only admins can connect GitHub repos.' };
    const { repoExists } = await import('@/lib/github');
    const check = await repoExists(input.owner, input.repo);
    if (!check.ok) return { ok: false, error: `GitHub says no access to ${input.owner}/${input.repo} (status ${check.status ?? 'unknown'}). Check GITHUB_TOKEN and repo casing.` };

    // Resolve target project: explicit pick, else attach an unlinked project, else auto-create one for the repo.
    let projectId = input.projectId && input.projectId !== 'auto' ? input.projectId : null;
    if (!projectId) {
      const free = await db.project.findFirst({
        where: { githubConnections: { none: {} } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (free) projectId = free.id;
    }
    if (!projectId) {
      const title = input.repo.replace(/[-_.]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const created = await db.project.create({
        data: { name: title.slice(0, 120), clientName: input.owner.slice(0, 120), service: 'Website', status: 'PLANNING', ownerId: u.id },
        select: { id: true },
      });
      projectId = created.id;
    }
    const conn = await db.gitHubConnection.upsert({
      where: { projectId },
      create: { projectId, owner: input.owner, repo: input.repo, branch: input.branch, repoId: check.id ? String(check.id) : null, connectedById: u.id, status: 'connected' },
      update: { owner: input.owner, repo: input.repo, branch: input.branch, repoId: check.id ? String(check.id) : null, connectedById: u.id, status: 'connected' },
    });
    // Auto-wire Vercel so the site is immediately deployable from the Deployments tab.
    const { vercelConfigured, ensureVercelProject, slugifyVercelName } = await import('@/lib/vercel');
    let deployNote = '';
    if (vercelConfigured() && projectId) {
      const existingConn = await db.deploymentConnection.findUnique({ where: { projectId }, select: { id: true } });
      if (!existingConn) {
        const vp = await ensureVercelProject(slugifyVercelName(`${input.owner}-${input.repo}`));
        if (vp) {
          await db.deploymentConnection.create({
            data: { projectId, vercelProjectId: vp.id },
          });
          deployNote = ` Vercel project “${vp.name}” linked — preview/production deploys ready.`;
        } else {
          deployNote = ' Could not auto-link a Vercel project (API refused) — configure it manually in the Deployments tab.';
        }
      }
    }
    await logActivity(u.id, 'GitHub repo connected', `${input.owner}/${input.repo} (${conn.branch})${deployNote}`);
    revalidatePath('/workspace/github');
    revalidatePath('/workspace/vercel');
    return okRes(`Connected ${input.owner}/${input.repo} @ ${conn.branch}. ${deployNote}`.trim());
  } catch (e) {
    return fail(e);
  }
}

export async function disconnectGithub(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    if (u.role !== 'ADMIN') return { ok: false, error: 'Only admins can disconnect repos.' };
    const id = z.string().min(1).parse(raw);
    // The payload is the project id; fall back to the connection id for legacy unlinked rows.
    const target = await db.gitHubConnection.findFirst({
      where: { OR: [{ projectId: id }, { id }] },
      select: { projectId: true, owner: true, repo: true },
    });
    if (!target) return { ok: false, error: 'Repo connection not found.' };
    const projectId = target.projectId ?? id;
    await db.$transaction([
      db.gitHubConnection.deleteMany({ where: { OR: [{ id }, ...(target.projectId ? [{ projectId: target.projectId }] : [])] } }),
      db.deploymentConnection.deleteMany({ where: { projectId } }),
    ]);
    await logActivity(u.id, 'GitHub repo disconnected', `${target.owner}/${target.repo}`);
    revalidatePath('/workspace/github');
    revalidatePath('/workspace/vercel');
    return okRes(`Disconnected ${target.owner}/${target.repo}.`);
  } catch (e) {
    return fail(e);
  }
}

export async function configureDeploy(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = deployConfigSchema.parse(raw);
    if (u.role !== 'ADMIN') return { ok: false, error: 'Only admins can configure Vercel.' };
    await db.deploymentConnection.upsert({
      where: { projectId: input.projectId },
      create: { projectId: input.projectId, vercelProjectId: input.vercelProjectId, vercelTeamId: input.vercelTeamId ?? null },
      update: { vercelProjectId: input.vercelProjectId, vercelTeamId: input.vercelTeamId ?? null },
    });
    await logActivity(u.id, 'Vercel project configured', input.vercelProjectId);
    revalidatePath('/workspace/vercel');
    return okRes(`Vercel project ${input.vercelProjectId} connected.`);
  } catch (e) {
    return fail(e);
  }
}

export async function deployProject(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = z
      .object({ projectId: z.string().min(1), production: z.boolean().optional().default(false) })
      .refine((v) => v, { message: 'invalid' })
      .parse(raw);
    if (u.role !== 'ADMIN') return { ok: false, error: 'Only admins can trigger deploys.' };
    const conn = await db.deploymentConnection.findUnique({ where: { projectId: input.projectId }, include: { project: { select: { name: true } } } });
    if (!conn) return { ok: false, error: 'No Vercel project connected for this site yet.' };
    const gh = await db.gitHubConnection.findUnique({ where: { projectId: input.projectId }, select: { owner: true, repo: true, branch: true } });
    if (!gh) return { ok: false, error: 'Connect the GitHub repo first (Websites tab) — deploys build from it.' };
    if (input.production) {
      const proceed = (raw as { confirm?: boolean }).confirm;
      if (!proceed) return { ok: false, error: 'Confirm production deploy first (pass confirm).' };
    }
    const { createDeployment, vercelConfigured } = await import('@/lib/vercel');
    if (!vercelConfigured()) return { ok: false, error: 'VERCEL_TOKEN is not configured in this environment.' };
    let out: { vercelId: string; url?: string; status: string };
    try {
      out = await createDeployment(conn.vercelProjectId, conn.vercelTeamId ?? undefined, input.production ? 'production' : 'preview', {
        repo: `${gh.owner}/${gh.repo}`,
        ref: gh.branch,
        message: `${input.production ? 'Production' : 'Preview'} deploy fired from Corble workspace`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const friendly = msg.startsWith('NOT_CONFIGURED') ? 'VERCEL_TOKEN not configured in this environment.' : msg.startsWith('VERCEL ') ? `Vercel API error â€” ${msg.slice(0, 240)}` : msg.slice(0, 240);
      await db.deploymentRecord.create({
        data: {
          projectId: conn.projectId,
          environment: input.production ? 'production' : 'preview',
          status: 'FAILED',
          errorSummary: friendly.slice(0, 500),
        },
      });
      return { ok: false, error: friendly };
    }
    const record = await db.deploymentRecord.create({
      data: {
        projectId: conn.projectId,
        vercelId: out.vercelId,
        environment: input.production ? 'production' : 'preview',
        status: input.production ? 'QUEUED' : 'BUILDING',
        url: out.url ?? null,
        previewUrl: out.url ?? null,
      },
    });
    await db.activity.create({ data: { message: `Vercel deploy started (${record.environment})`, detail: `${conn.project.name} â†’ ${out.url ?? out.vercelId}`, userId: u.id } });
    revalidatePath('/workspace/vercel');
    return okRes(`Deploy queued: ${out.url ?? out.vercelId}`);
  } catch (e) {
    return fail(e);
  }
}

/* ================= PHASE 8 â€” TEMPLATE CATEGORIES & IMPORT ================= */

export async function importTemplate(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = templateImportSchema.parse(raw);
    if (u.role !== 'ADMIN') return { ok: false, error: 'Only admins can import templates.' };
    let origin = '';
    let path = '';
    try {
      const url = new URL(input.url);
      if (!/(^|\.)github\.com$/i.test(url.hostname)) return { ok: false, error: 'Only public GitHub repo URLs are supported for template import.' };
      origin = url.pathname.split('/').filter(Boolean).slice(0, 2).join('/');
      path = url.pathname.split('/').filter(Boolean)[1] ?? 'repo';
    } catch {
      return { ok: false, error: 'Invalid URL.' };
    }
    const name = path.replace(/[-_.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const existing = await db.template.findFirst({ where: { OR: [{ source: origin }, { name, kind: input.kind }] } });
    if (existing) {
      await db.template.update({
        where: { id: existing.id },
        data: { kind: input.kind, source: origin, repoUrl: input.url, updatedAt: new Date() },
      });
      await logActivity(u.id, `Template refreshed (${input.kind.toLowerCase()})`, existing.name);
      revalidatePath('/workspace/templates');
      return okRes(`Template updated: ${existing.name}.`);
    }
    const t = await db.template.create({
      data: {
        name,
        description: `Imported from GitHub (${origin}). Fill in steps/env vars after review.`,
        kind: input.kind,
        source: origin,
        repoUrl: input.url,
      },
    });
    await logActivity(u.id, 'Template imported', `${t.name} (${input.kind})`);
    revalidatePath('/workspace/templates');
    return okRes(`Template imported: ${t.name} â€” review its steps, framework and env vars.`);
  } catch (e) {
    return fail(e);
  }
}




export async function exportN8nWorkflow(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = z.object({ workflowId: z.string().min(1).max(80) }).parse(raw);
    if (u.role !== 'ADMIN') return { ok: false, error: 'Only admins can export n8n workflows.' };
    const { getWorkflow, n8nConfigured } = await import('@/lib/n8n');
    const { saveContent } = await import('@/lib/storage');
    if (!n8nConfigured()) return { ok: false, error: 'n8n not configured (N8N_BASE_URL / N8N_API_KEY).' };
    const { summary, json } = await getWorkflow(input.workflowId);
    const content = JSON.stringify(json, null, 2);
    const fileName = `${summary.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)}-wf-${summary.id}.json`;
    const saved = await saveContent(fileName, 'application/json', content);
    const asset = await db.fileAsset.create({
      data: {
        name: fileName,
        size: saved.size,
        mimeType: 'application/json',
        storageKey: saved.storageKey,
        storage: saved.storage,
        uploadedById: u.id,
      },
    });
    await logActivity(u.id, 'n8n workflow exported', `${summary.name} -> files/${asset.id}`);
    revalidatePath('/workspace/files');
    revalidatePath('/workspace/n8n');
    return okRes(`Exported ${summary.name} to Files.`);
  } catch (e) {
    return fail(e);
  }
}

export async function importN8nWorkflow(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = z.object({ assetId: z.string().min(1), name: z.string().max(120).optional() }).parse(raw);
    if (u.role !== 'ADMIN') return { ok: false, error: 'Only admins can import n8n workflows.' };
    const { readStoredText } = await import('@/lib/storage');
    const { createWorkflow, n8nConfigured } = await import('@/lib/n8n');
    if (!n8nConfigured()) return { ok: false, error: 'n8n not configured (N8N_BASE_URL / N8N_API_KEY).' };
    const asset = await db.fileAsset.findUnique({ where: { id: input.assetId } });
    if (!asset) return { ok: false, error: 'File not found.' };
    const direct = await readStoredText(asset.storageKey, asset.storage);
    if (!direct) return { ok: false, error: 'File content unreadable — try downloading it first and re-importing.' };
    const created = await createWorkflow(direct, input.name);
    await logActivity(u.id, 'n8n workflow imported', `${created.name} -> n8n id ${created.id} (from ${asset.name})`);
    revalidatePath('/workspace/n8n');
    return okRes(`Imported to n8n as id ${created.id} (${created.name}).`);
  } catch (e) {
    return fail(e);
  }
}

export async function moveFile(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = z
      .object({
        assetId: z.string().min(1),
        projectId: z.string().nullable().optional(),
        taskId: z.string().nullable().optional(),
      })
      .parse(raw);
    const asset = await db.fileAsset.findUnique({ where: { id: input.assetId }, select: { id: true, uploadedById: true, name: true } });
    if (!asset) return { ok: false, error: 'File not found.' };
    if (u.role !== 'ADMIN' && asset.uploadedById !== u.id) return { ok: false, error: 'Only admins (or the uploader) can move files.' };

    if (input.taskId) {
      const task = await db.task.findUnique({ where: { id: input.taskId }, select: { id: true } });
      if (!task) return { ok: false, error: 'Task not found.' };
      const moved = await db.fileAsset.update({ where: { id: asset.id }, data: { taskId: task.id, projectId: null } });
      await logActivity(u.id, 'File moved to task', `${asset.name} -> task ${input.taskId}`);
      revalidatePath('/workspace/files');
      return okRes(`"${moved.name}" attached to the task.`);
    }
    if (input.projectId) {
      const project = await db.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
      if (!project) return { ok: false, error: 'Project not found.' };
      const moved = await db.fileAsset.update({
        where: { id: asset.id },
        data: { taskId: null, projectId: project.id },
      });
      await logActivity(u.id, 'File moved to project', `${asset.name} -> ${input.projectId}`);
      revalidatePath('/workspace/files');
      return okRes(`"${moved.name}" attached to the project.`);
    }
    const moved = await db.fileAsset.update({
      where: { id: asset.id },
      data: { taskId: null, projectId: null },
    });
    await logActivity(u.id, 'File detached to library', asset.name);
    revalidatePath('/workspace/files');
    return okRes(`"${moved.name}" is back in the shared library.`);
  } catch (e) {
    return fail(e);
  }
}

export async function linkCompanies(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = z
      .object({
        assetId: z.string().min(1),
        companies: z.array(z.object({ kind: z.enum(['LEAD', 'INCOMING']), id: z.string().min(1) })).min(1),
      })
      .parse(raw);
    const asset = await db.fileAsset.findUnique({ where: { id: input.assetId }, select: { uploadedById: true, name: true } });
    if (!asset) return { ok: false, error: 'File not found.' };
    if (u.role !== 'ADMIN' && asset.uploadedById !== u.id) return { ok: false, error: 'Only admins (or the uploader) can link companies.' };

    const existing = await db.fileLeadLink.findMany({
      where: { fileAssetId: input.assetId },
      select: { kind: true, leadId: true, incomingLeadId: true },
    });
    const dup = (k: string, id: string) =>
      existing.some((l) => l.kind === k && (k === 'LEAD' ? l.leadId === id : l.incomingLeadId === id));

    let added = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const c of input.companies) {
      if (dup(c.kind, c.id)) {
        skipped++;
        continue;
      }
      if (c.kind === 'LEAD') {
        const lead = await db.lead.findUnique({ where: { id: c.id }, select: { id: true } });
        if (!lead) {
          errors.push('lead not found');
          continue;
        }
        await db.fileLeadLink.create({ data: { kind: 'LEAD', leadId: c.id, fileAssetId: input.assetId } });
      } else {
        const incoming = await db.incomingLead.findUnique({ where: { id: c.id }, select: { id: true } });
        if (!incoming) {
          errors.push('incoming lead not found');
          continue;
        }
        await db.fileLeadLink.create({ data: { kind: 'INCOMING', incomingLeadId: c.id, fileAssetId: input.assetId } });
      }
      added++;
    }
    if (added) await logActivity(u.id, 'Companies linked to file', `${asset.name}: +${added}`);
    revalidatePath('/workspace/files');
    const parts = [`Linked ${added} compan${added === 1 ? 'y' : 'ies'}.`];
    if (skipped) parts.push(`${skipped} already linked.`);
    if (errors.length) parts.push(`${errors.length} not found.`);
    return okRes(parts.join(' '));
  } catch (e) {
    return fail(e);
  }
}

export async function unlinkCompanies(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = z
      .object({
        assetId: z.string().min(1),
        linkIds: z.array(z.string().min(1)).min(1),
      })
      .parse(raw);
    const asset = await db.fileAsset.findUnique({ where: { id: input.assetId }, select: { uploadedById: true, name: true } });
    if (!asset) return { ok: false, error: 'File not found.' };
    if (u.role !== 'ADMIN' && asset.uploadedById !== u.id) return { ok: false, error: 'Only admins (or the uploader) can unlink companies.' };
    const out = await db.fileLeadLink.deleteMany({ where: { id: { in: input.linkIds }, fileAssetId: input.assetId } });
    if (out.count) await logActivity(u.id, 'Companies unlinked from file', `${asset.name}: -${out.count}`);
    revalidatePath('/workspace/files');
    return okRes(`Removed ${out.count} company link${out.count === 1 ? '' : 's'}.`);
  } catch (e) {
    return fail(e);
  }
}
