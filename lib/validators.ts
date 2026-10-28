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

/** Accept empty string or a string ID (cuid/uuid). Never coerce to number. */
const idOrEmpty = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === '' || v === 'auto' ? null : v.trim()))
  .refine((d) => d === null || d.length > 0, 'Invalid id');

export const leadSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  contactPerson: z.string().trim().max(120).optional().default(''),
  service: z.string().trim().min(1).max(80),
  source: z.string().trim().min(1).max(80),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST']),
  estValue: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  nextFollowUp: dateish,
  ownerId: idOrEmpty,
});

export const leadStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST']),
});

export const projectSchema = z.object({
  name: z.string().trim().min(1).max(140),
  clientName: z.string().trim().min(1).max(140),
  leadId: idOrEmpty,
  service: z.string().trim().min(1).max(80),
  status: z.enum(['PLANNING', 'IN_PROGRESS', 'REVIEW', 'DELIVERED', 'COMPLETED']),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  dueDate: dateish,
  ownerId: idOrEmpty,
  budget: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
});

export const projectStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['PLANNING', 'IN_PROGRESS', 'REVIEW', 'DELIVERED', 'COMPLETED']),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  projectId: idOrEmpty,
  assigneeId: idOrEmpty,
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']),
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
  projectId: idOrEmpty,
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
