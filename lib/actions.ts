'use server';

import { revalidatePath } from 'next/cache';
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
  leadStatusSchema,
  projectSchema,
  projectStatusSchema,
  taskSchema,
  taskInlineSchema,
  financeSchema,
  userAdminSchema,
  settingsSchema,
  passwordResetSchema,
  templateUseSchema,
} from '@/lib/validators';
import { notifyTaskAssigned } from '@/lib/mail';

export type ActionResult = { ok: boolean; error?: string; message?: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  return { id: session.user.id as string, role: (session.user.role ?? 'MEMBER') as Role, name: session.user.name ?? '' };
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
  }
  return { ok: false, error: 'Something went wrong. Try again.' };
}

function okRes(message: string): ActionResult {
  return { ok: true, message };
}

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
  void notifyTaskAssigned({
    assigneeEmail: assignee.email,
    assigneeName: assignee.name,
    taskTitle: task.title,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate,
    assignedBy: assignedByName,
    projectName,
  }).catch(() => {});
}

/* ------------------------------ LEADS ------------------------------ */

export async function createLead(raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireUser();
    const input = leadSchema.parse(raw);
    const lead = await db.lead.create({
      data: {
        name: input.name,
        contactPerson: input.contactPerson || null,
        service: input.service,
        source: input.source,
        status: input.status as LeadStatus,
        estValue: input.estValue,
        nextFollowUp: input.nextFollowUp,
        ownerId: input.ownerId ?? null,
      },
    });
    await logActivity(u.id, 'Lead created', `${lead.name} · ${lead.service}`);
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
    await logActivity(u.id, 'Lead status changed', `${lead.name} → ${status}`);
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
    const lead = await db.lead.delete({ where: { id } });
    await logActivity(u.id, 'Lead deleted', lead.name);
    revalidatePath('/workspace/leads');
    revalidatePath('/workspace');
    return okRes('Lead deleted.');
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
        name: `${lead.name} — ${lead.service}`,
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
    await logActivity(u.id, 'Project status changed', `${p.name} → ${status}`);
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
        projectId: input.projectId ?? null,
        assigneeId: input.assigneeId ?? null,
        priority: input.priority as TaskPriority,
        status: input.status as TaskStatus,
        dueDate: input.dueDate,
      },
    });
    await logActivity(u.id, 'Task created', t.title);
    await notifyAssigneeIfAny(input.assigneeId, t, u.name);
    revalidatePath('/workspace');
    revalidatePath('/workspace/tasks');
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
    const prev = await db.task.findUnique({ where: { id }, select: { assigneeId: true } });
    const t = await db.task.update({
      where: { id },
      data: {
        title: input.title,
        projectId: input.projectId ?? null,
        assigneeId: input.assigneeId ?? null,
        priority: input.priority as TaskPriority,
        status: input.status as TaskStatus,
        dueDate: input.dueDate,
      },
    });
    await logActivity(u.id, 'Task updated', t.title);
    if (input.assigneeId && input.assigneeId !== prev?.assigneeId) {
      await notifyAssigneeIfAny(input.assigneeId, t, u.name);
    }
    revalidatePath('/workspace/tasks');
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
    const prev = await db.task.findUnique({ where: { id }, select: { assigneeId: true } });
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
    const t = await db.task.delete({ where: { id } });
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
    const password = input.password ?? 'CorbleDemo123!';
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
    const user = await db.user.delete({ where: { id } });
    await logActivity(u.id, 'Team member removed', user.name);
    revalidatePath('/workspace/team');
    return okRes('User removed.');
  } catch (e) {
    return fail(e);
  }
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
    await logActivity(u.id, 'Settings updated', `${s.companyName} · ${s.currency} · ${s.timezone}`);
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
