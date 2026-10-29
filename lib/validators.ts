import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const dateish = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), 'Invalid date');

const intOrEmpty = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === '' ? null : Number(v)))
  .refine((d) => d === null || Number.isInteger(d), 'Invalid number');

export const leadSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  contactPerson: z.string().trim().max(120).optional().default(''),
  service: z.string().trim().min(1).max(80),
  source: z.string().trim().min(1).max(80),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST']),
  estValue: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  nextFollowUp: dateish,
  ownerId: intOrEmpty.transform((v) => (typeof v === 'number' && v !== null ? String(v) : null)),
});

export const leadStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST']),
});

export const projectSchema = z.object({
  name: z.string().trim().min(1).max(140),
  clientName: z.string().trim().min(1).max(140),
  leadId: intOrEmpty.transform((v) => (typeof v === 'number' && v !== null ? String(v) : null)),
  service: z.string().trim().min(1).max(80),
  status: z.enum(['PLANNING', 'IN_PROGRESS', 'REVIEW', 'DELIVERED', 'COMPLETED']),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  dueDate: dateish,
  ownerId: intOrEmpty.transform((v) => (typeof v === 'number' && v !== null ? String(v) : null)),
  budget: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
});

export const projectStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['PLANNING', 'IN_PROGRESS', 'REVIEW', 'DELIVERED', 'COMPLETED']),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim().slice(0, 2000) : null)),
  projectId: intOrEmpty.transform((v) => (typeof v === 'number' && v !== null ? String(v) : null)),
  assigneeId: intOrEmpty.transform((v) => (typeof v === 'number' && v !== null ? String(v) : null)),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']),
  startDate: dateish,
  dueDate: dateish,
});

export const taskInlineSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  assigneeId: z.string().optional(),
});

export const financeSchema = z.object({
  type: z.enum(['INVOICE', 'PAYMENT', 'EXPENSE']),
  description: z.string().trim().min(1).max(240),
  amount: z.coerce.number().int().min(0).max(1_000_000_000),
  status: z.enum(['PENDING', 'RECEIVED', 'PAID', 'OVERDUE']),
  date: z.string().min(1).transform((v) => new Date(v)).refine((d) => !Number.isNaN(d.getTime()), 'Invalid date'),
  projectId: intOrEmpty.transform((v) => (typeof v === 'number' && v !== null ? String(v) : null)),
});

export const userAdminSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['ADMIN', 'MEMBER']),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100).optional(),
});

export const settingsSchema = z.object({
  companyName: z.string().trim().min(1).max(80),
  currency: z.enum(['EGP', 'USD']),
  timezone: z.string().trim().min(1).max(60),
  theme: z.enum(['dark', 'light']),
});

export const passwordResetSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8).max(100),
});

export const templateUseSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().trim().min(1).max(140),
  clientName: z.string().trim().min(1).max(140),
  budget: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  dueDate: dateish,
});

export type FieldSpec = {
  label: string;
  name: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'email' | 'password';
  options?: { value: string; label: string }[];
  required?: boolean;
  full?: boolean;
  value?: string | number;
  placeholder?: string;
};

/* ------------------ Phase 1�10 additions ------------------ */

export const handoverRequestSchema = z.object({
  taskId: z.string().min(1),
  note: z.string().trim().max(300).optional(),
});

export const handoverDecisionSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(['approv', 'reject']),
});

export const taskEligibilitySchema = z.object({
  taskId: z.string().min(1),
  eligible: z.boolean(),
});

export const taskCommentSchema = z.object({
  taskId: z.string().min(1),
  body: z.string().trim().min(1).max(1000),
});

export const deliverableSchema = z.object({
  title: z.string().trim().min(1).max(160),
  taskId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
  externalUrl: z.string().url().max(400).optional(),
  fileId: z.string().min(1).optional(),
});

export const deliverableReviewSchema = z.object({
  versionId: z.string().min(1),
  decision: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'REJECTED']),
  comment: z.string().trim().min(1).max(2000),
});

const nullableText = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null));

export const incomingLeadSchema = z.object({
  company: z.string().trim().min(1).max(160),
  contactPerson: nullableText,
  email: z
    .string()
    .optional()
    .transform((v) => (v && v.includes('@') ? v.trim().toLowerCase() : null)),
  phone: nullableText,
  website: nullableText,
  domain: nullableText,
  industry: nullableText,
  location: nullableText,
  source: z.string().trim().min(1).max(80).default('Manual'),
  sourceUrl: z.string().url().max(400).optional().nullable().transform((v) => v ?? null),
  externalId: nullableText,
  workflowId: nullableText,
  batchId: nullableText,
  notes: z.string().max(4000).optional(),
});

export const researchUpdateSchema = z.object({
  leadId: z.string().min(1),
  body: z.string().trim().min(1).max(3000),
  sourceUrl: z.string().url().max(400).optional().nullable().transform((v) => v ?? null),
});

export const verifyActionSchema = z.object({
  leadId: z.string().min(1),
  method: z.enum(['EMAIL_SYNTAX', 'DOMAIN_DNS', 'WEBSITE_FETCH', 'MANUAL_REVIEW']),
});

export const promoteLeadSchema = z.object({
  incomingId: z.string().min(1),
  ownerId: nullableText,
  estValue: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  overrideCompany: z.string().trim().max(160).optional(),
});

export const importCommitSchema = z.object({
  filename: z.string().trim().max(200).default('upload.csv'),
  csv: z.string().min(1).max(2_000_000),
});

export const automationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().transform((v) => v ?? null),
  ownerId: nullableText,
  maintainerId: nullableText,
  githubRepo: nullableText,
  websiteProjectId: nullableText,
});

export const phaseSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().transform((v) => v ?? null),
  ownerId: nullableText,
  dueDate: dateish,
  dependsOnId: nullableText,
});

export const phaseSubmitSchema = z.object({
  phaseId: z.string().min(1),
  notes: z.string().trim().min(1).max(4000),
});

export const phaseReviewSchema = z.object({
  submissionId: z.string().min(1),
  decision: z.enum(['APPROVED', 'CHANGES_REQUESTED']),
  comment: z.string().trim().max(2000).optional(),
});

export const finalDeliverySchema = z.object({
  projectId: z.string().min(1),
  repoUrl: z.string().url().max(400).optional(),
  websiteUrl: z.string().url().max(400).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const acceptDeliverySchema = z.object({
  projectId: z.string().min(1),
});

export const githubConnectSchema = z.object({
  projectId: z.string().min(1),
  owner: z.string().trim().min(1).max(100),
  repo: z.string().trim().min(1).max(100),
  branch: z.string().trim().min(1).max(120).default('main'),
});

export const deployConfigSchema = z.object({
  projectId: z.string().min(1),
  vercelProjectId: z.string().trim().min(1).max(160),
  vercelTeamId: nullableText,
});

export const templateImportSchema = z.object({
  kind: z.enum(['AUTOMATION', 'WEBSITE']),
  url: z.string().url().max(400),
});

export const notificationReadSchema = z.object({
  id: z.string().min(1),
  all: z.boolean().optional(),
});
