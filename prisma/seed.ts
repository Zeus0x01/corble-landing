import { PrismaClient, LeadStatus, ProjectStatus, TaskStatus, TaskPriority, FinanceType, FinanceStatus, Role, TemplateKind, PhaseStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
    throw new Error(
      'Refusing to seed: NODE_ENV is production. Demo data must never be created in production. Set ALLOW_SEED=true ONLY if you truly understand the risk.'
    );
  }
  const rawPassword = process.env.SEED_ADMIN_PASSWORD || 'CorbleDemo123!';
  if (process.env.NODE_ENV === 'production' && rawPassword === 'CorbleDemo123!') {
    throw new Error('Refusing to seed with the known demo password in production. Set SEED_ADMIN_PASSWORD to something unique.');
  }
  const password = await bcrypt.hash(rawPassword, 10);

  // Children before parents so re-runs and FK constraints never fail.
  await prisma.activity.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.fileLeadLink.deleteMany();
  await prisma.deliverableReview.deleteMany();
  await prisma.deliverableVersion.deleteMany();
  await prisma.deliverable.deleteMany();
  await prisma.phaseSubmission.deleteMany();
  await prisma.automationPhase.deleteMany();
  await prisma.automationProject.deleteMany();
  await prisma.leadVerificationCheck.deleteMany();
  await prisma.leadResearchUpdate.deleteMany();
  await prisma.incomingLead.deleteMany();
  await prisma.ingestionRun.deleteMany();
  await prisma.leadImportBatch.deleteMany();
  await prisma.handoverRequest.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.financeRecord.deleteMany();
  await prisma.task.deleteMany();
  await prisma.gitHubConnection.deleteMany();
  await prisma.deploymentRecord.deleteMany();
  await prisma.deploymentConnection.deleteMany();
  await prisma.project.deleteMany();
  await prisma.fileAsset.deleteMany();
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
      leadCode: 'LEAD-000001',
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
      leadCode: 'LEAD-000002',
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
      leadCode: 'LEAD-000003',
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
      leadCode: 'LEAD-000004',
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
        kind: TemplateKind.WEBSITE,
        source: 'manual',
        framework: 'Next.js',
        envVarNames: ['DATABASE_URL', 'AUTH_SECRET'],
      },
      {
        name: 'Booking Automation',
        description: 'WhatsApp-first booking and follow-up automation.',
        steps: ['Map current flow', 'Connect WhatsApp Business', 'Build booking flows', 'Train staff', 'Go live'],
        kind: TemplateKind.AUTOMATION,
        source: 'manual',
        envVarNames: ['WHATSAPP_TOKEN', 'N8N_WEBHOOK_URL'],
      },
      {
        name: 'Security Review',
        description: 'Baseline security assessment for small businesses.',
        steps: ['Access audit', 'Risk report', 'Fix list', 'Remediation', 'Re-test'],
        kind: TemplateKind.AUTOMATION,
        source: 'manual',
      },
    ],
  });

  const importBatch = await prisma.leadImportBatch.create({
    data: { filename: 'kickoff-incoming-leads.csv', totalRows: 4, validRows: 3, invalidRows: 0, duplicateRows: 1 },
  });
  await prisma.incomingLead.createMany({
    data: [
      {
        leadCode: 'LEAD-000005',
        company: 'Smile Center Clinic',
        contactPerson: 'Dr. Maya Habib',
        email: 'frontdesk@smilecenter.eg',
        phone: '+20 100 555 1810',
        website: 'https://smilecenter.eg',
        domain: 'smilecenter.eg',
        industry: 'Dental',
        location: 'Cairo, EG',
        source: 'n8n: booking-form scraper',
        workflowId: 'wf-scraper-01',
        externalId: 'rec-1042',
        rawPayload: { company: 'Smile Center Clinic', email: 'frontdesk@smilecenter.eg', website: 'https://smilecenter.eg', extra: 'scraped from booking page' },
        normalized: { email: 'frontdesk@smilecenter.eg', domain: 'smilecenter.eg' },
        processingStatus: 'NEW',
        batchId: importBatch.id,
        importBatchId: importBatch.id,
      },
      {
        leadCode: 'LEAD-000006',
        company: 'Glow Fitness Studio',
        email: 'hello@glowfit.ma',
        website: 'https://glowfit.ma',
        domain: 'glowfit.ma',
        industry: 'Fitness',
        location: 'Casablanca, MA',
        source: 'n8n: instagram dm parser',
        workflowId: 'wf-igdm-02',
        externalId: 'rec-1077',
        rawPayload: { company: 'Glow Fitness Studio', email: 'hello@glowfit.ma' },
        processingStatus: 'NEW',
      },
      {
        leadCode: 'LEAD-000007',
        company: 'Petit Pret Retail',
        email: 'buyer@petitpret.com',
        industry: 'Retail',
        source: 'Manual research',
        workflowId: null,
        externalId: null,
        rawPayload: { company: 'Petit Pret Retail', email: 'buyer@petitpret.com' },
        processingStatus: 'UNDER_REVIEW',
        researchNotes: 'Reached out on 10-24, awaiting purchasing manager reply.',
      },
      {
        leadCode: 'LEAD-000008',
        company: 'Smile Center Clinic',
        email: 'frontdesk@smilecenter.eg',
        source: 'n8n: booking-form scraper',
        workflowId: 'wf-scraper-01',
        externalId: 'rec-1042-dup',
        rawPayload: { company: 'Smile Center Clinic' },
        processingStatus: 'DUPLICATE',
        batchId: importBatch.id,
        importBatchId: importBatch.id,
      },
    ],
  });
  await prisma.leadIdSequence.upsert({
    where: { id: 1 },
    update: { nextValue: 9 },
    create: { id: 1, nextValue: 9 },
  });

  const automation = await prisma.automationProject.create({
    data: {
      name: 'Clinic Booking Automation',
      description: 'End-to-end booking pipeline: WhatsApp intake, calendar sync, reminder flows.',
      status: ProjectStatus.IN_PROGRESS,
      ownerId: nour.id,
      maintainerId: youssef.id,
      githubRepo: 'Zeus0x01/booking-automation',
    },
  });
  const phaseIntake = await prisma.automationPhase.create({
    data: { projectId: automation.id, title: 'Phase 1 — WhatsApp intake flow', description: 'Capture patient details via WhatsApp template flows.', order: 1, status: PhaseStatus.NOT_STARTED, ownerId: nour.id },
  });
  await prisma.automationPhase.createMany({
    data: [
      { projectId: automation.id, title: 'Phase 2 — Calendar & reminder sync', description: 'Two-way Google Calendar sync and 24h reminder messages.', order: 2, status: PhaseStatus.NOT_STARTED, ownerId: youssef.id },
      { projectId: automation.id, title: 'Phase 3 — Staff dashboard handover', description: 'Daily bookings digest and training material for clinic staff.', order: 3, status: PhaseStatus.NOT_STARTED, ownerId: ahmed.id, dueDate: new Date('2026-11-15'), dependsOnId: phaseIntake.id },
    ],
  });
  await prisma.notification.deleteMany({ where: { type: 'SEED' } });

  await prisma.activity.createMany({
    data: [
      { message: 'Lead created', detail: 'Bright Dental Clinic · AI Automation · EGP 18,000', userId: nour.id },
      { message: 'Project status changed', detail: 'Security Review → Review', userId: youssef.id },
      { message: 'Payment received', detail: 'Website discovery deposit · EGP 5,000', userId: ahmed.id },
    ],
  });

  console.log(`Seed complete: admin admin@corble.net / ${process.env.SEED_ADMIN_PASSWORD ? 'password from SEED_ADMIN_PASSWORD' : 'default demo password (dev only!)'}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
