import { PrismaClient, LeadStatus, ProjectStatus, TaskStatus, TaskPriority, FinanceType, FinanceStatus, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('CorbleDemo123!', 10);

  await prisma.activity.deleteMany();
  await prisma.fileAsset.deleteMany();
  await prisma.financeRecord.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.template.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.user.deleteMany();

  const ahmed = await prisma.user.create({
    data: {
      name: 'Ahmed Hamdy',
      email: 'admin@corble.net',
      passwordHash: password,
      role: Role.ADMIN,
      theme: 'dark',
    },
  });
  const nour = await prisma.user.create({
    data: {
      name: 'Nour',
      email: 'nour@corble.net',
      passwordHash: password,
      role: Role.MEMBER,
      theme: 'dark',
    },
  });
  const youssef = await prisma.user.create({
    data: {
      name: 'Youssef',
      email: 'youssef@corble.net',
      passwordHash: password,
      role: Role.MEMBER,
      theme: 'dark',
    },
  });

  await prisma.settings.upsert({
    where: { id: 'global' },
    update: {},
    create: {
      id: 'global',
      companyName: 'Corble',
      currency: 'EGP',
      timezone: 'Africa/Cairo',
      theme: 'dark',
    },
  });

  const dental = await prisma.lead.create({
    data: {
      name: 'Bright Dental Clinic',
      contactPerson: 'Mariam Hassan',
      service: 'AI Automation',
      source: 'Google Maps',
      status: LeadStatus.CONTACTED,
      estValue: 18000,
      nextFollowUp: new Date('2026-10-29'),
      ownerId: nour.id,
    },
  });
  const nile = await prisma.lead.create({
    data: {
      name: 'Nile Logistics',
      contactPerson: 'Omar Adel',
      service: 'Web Development',
      source: 'Referral',
      status: LeadStatus.PROPOSAL_SENT,
      estValue: 35000,
      nextFollowUp: new Date('2026-10-28'),
      ownerId: ahmed.id,
    },
  });
  const orbit = await prisma.lead.create({
    data: {
      name: 'Orbit Fitness',
      contactPerson: 'Salma Nabil',
      service: 'Website',
      source: 'Cold Outreach',
      status: LeadStatus.NEW,
      estValue: 12000,
      nextFollowUp: new Date('2026-10-30'),
      ownerId: ahmed.id,
    },
  });
  const cairo = await prisma.lead.create({
    data: {
      name: 'Cairo Retail Group',
      contactPerson: 'Karim Samy',
      service: 'Cybersecurity',
      source: 'Website',
      status: LeadStatus.QUALIFIED,
      estValue: 24000,
      nextFollowUp: new Date('2026-10-31'),
      ownerId: youssef.id,
    },
  });

  const p1 = await prisma.project.create({
    data: {
      name: 'Clinic Booking Automation',
      clientName: 'Bright Dental Clinic',
      leadId: dental.id,
      service: 'AI Automation',
      status: ProjectStatus.IN_PROGRESS,
      progress: 65,
      dueDate: new Date('2026-11-04'),
      ownerId: nour.id,
      budget: 18000,
    },
  });
  const p2 = await prisma.project.create({
    data: {
      name: 'Nile Logistics Website',
      clientName: 'Nile Logistics',
      leadId: nile.id,
      service: 'Web Development',
      status: ProjectStatus.PLANNING,
      progress: 20,
      dueDate: new Date('2026-11-12'),
      ownerId: ahmed.id,
      budget: 35000,
    },
  });
  const p3 = await prisma.project.create({
    data: {
      name: 'Security Review',
      clientName: 'Cairo Retail Group',
      leadId: cairo.id,
      service: 'Cybersecurity',
      status: ProjectStatus.REVIEW,
      progress: 90,
      dueDate: new Date('2026-10-30'),
      ownerId: youssef.id,
      budget: 24000,
    },
  });

  await prisma.task.createMany({
    data: [
      { title: 'Finalize booking workflow', projectId: p1.id, assigneeId: nour.id, priority: TaskPriority.HIGH, status: TaskStatus.IN_PROGRESS, dueDate: new Date('2026-10-28') },
      { title: 'Prepare website proposal', projectId: p2.id, assigneeId: ahmed.id, priority: TaskPriority.HIGH, status: TaskStatus.TODO, dueDate: new Date('2026-10-28') },
      { title: 'Review security findings', projectId: p3.id, assigneeId: youssef.id, priority: TaskPriority.MEDIUM, status: TaskStatus.TODO, dueDate: new Date('2026-10-29') },
      { title: 'Schedule discovery call', projectId: p1.id, assigneeId: nour.id, priority: TaskPriority.LOW, status: TaskStatus.DONE, dueDate: new Date('2026-10-26') },
    ],
  });

  await prisma.financeRecord.createMany({
    data: [
      { type: FinanceType.INVOICE, description: 'Clinic automation · milestone 1', amount: 9000, status: FinanceStatus.PENDING, date: new Date('2026-10-24'), projectId: p1.id },
      { type: FinanceType.PAYMENT, description: 'Website discovery deposit', amount: 5000, status: FinanceStatus.RECEIVED, date: new Date('2026-10-22'), projectId: p2.id },
      { type: FinanceType.EXPENSE, description: 'Domain and hosting', amount: 850, status: FinanceStatus.PAID, date: new Date('2026-10-20'), projectId: p2.id },
    ],
  });

  await prisma.template.createMany({
    data: [
      {
        name: 'Business Website',
        description: 'Standard 5-page business website in 2 weeks.',
        steps: ['Discovery call', 'Sitemap & copy', 'Design', 'Build', 'QA & launch'],
      },
      {
        name: 'Booking Automation',
        description: 'WhatsApp-first booking and follow-up automation.',
        steps: ['Map current flow', 'Connect WhatsApp Business', 'Build booking flows', 'Train staff', 'Go live'],
      },
      {
        name: 'Security Review',
        description: 'Baseline security assessment for small businesses.',
        steps: ['Access audit', 'Risk report', 'Fix list', 'Remediation', 'Re-test'],
      },
    ],
  });

  await prisma.activity.createMany({
    data: [
      { message: 'Lead created', detail: 'Bright Dental Clinic · AI Automation · EGP 18,000', userId: nour.id },
      { message: 'Project status changed', detail: 'Security Review → Review', userId: youssef.id },
      { message: 'Payment received', detail: 'Website discovery deposit · EGP 5,000', userId: ahmed.id },
    ],
  });

  console.log('Seed complete: admin admin@corble.net / CorbleDemo123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
