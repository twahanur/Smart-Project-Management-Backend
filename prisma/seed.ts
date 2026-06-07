import { PrismaClient, BoardRole, WorkspaceRole, BoardVisibility, CardPriority, CardStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ── Clean Database ──────────────────────────────────────
  // (In order of dependencies)
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.checklist.deleteMany();
  await prisma.cardLabel.deleteMany();
  await prisma.label.deleteMany();
  await prisma.cardMember.deleteMany();
  await prisma.cardWatcher.deleteMany();
  await prisma.cardCustomFieldValue.deleteMany();
  await prisma.card.deleteMany();
  await prisma.boardList.deleteMany();
  await prisma.starredBoard.deleteMany();
  await prisma.boardMember.deleteMany();
  await prisma.customField.deleteMany();
  await prisma.board.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned database');

  // ── Demo Users ──────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@123', 12);
  const pmHash = await bcrypt.hash('PM@123456', 12);
  const memberHash = await bcrypt.hash('Member@123', 12);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@demo.com',
      password_hash: adminHash,
      role: 'admin',
      bio: 'System administrator with full access',
      preferences: { create: { theme: 'dark' } },
    },
  });

  const pm = await prisma.user.create({
    data: {
      name: 'Sarah Johnson',
      email: 'pm@demo.com',
      password_hash: pmHash,
      role: 'project_manager',
      bio: 'Project Manager with 5 years experience',
      preferences: { create: {} },
    },
  });

  const member1 = await prisma.user.create({
    data: {
      name: 'John Smith',
      email: 'member@demo.com',
      password_hash: memberHash,
      role: 'team_member',
      bio: 'Frontend Developer',
      preferences: { create: {} },
    },
  });

  const member2 = await prisma.user.create({
    data: {
      name: 'Jane Doe',
      email: 'jane@demo.com',
      password_hash: memberHash,
      role: 'team_member',
      bio: 'Backend Developer',
      preferences: { create: {} },
    },
  });

  console.log('✅ Users created');

  // ── Demo Workspaces ──────────────────────────────────────
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Demo Workspace',
      description: 'A workspace for collaborative development and project tracking',
      created_by: pm.id,
      members: {
        create: [
          { user_id: pm.id, role: WorkspaceRole.owner },
          { user_id: admin.id, role: WorkspaceRole.admin },
          { user_id: member1.id, role: WorkspaceRole.member },
          { user_id: member2.id, role: WorkspaceRole.member },
        ],
      },
    },
  });

  console.log('✅ Workspace created');

  // ── Demo Boards ──────────────────────────────────────────
  const board = await prisma.board.create({
    data: {
      workspace_id: workspace.id,
      name: 'E-Commerce App Development',
      description: 'Project board for tracking full-stack e-commerce app progress',
      background_color: '#3b82f6', // Premium Blue
      visibility: BoardVisibility.workspace,
      created_by: pm.id,
      members: {
        create: [
          { user_id: pm.id, role: BoardRole.admin },
          { user_id: admin.id, role: BoardRole.admin },
          { user_id: member1.id, role: BoardRole.member },
          { user_id: member2.id, role: BoardRole.member },
        ],
      },
    },
  });

  console.log('✅ Board created');

  // ── Demo BoardLists ──────────────────────────────────────
  const todoList = await prisma.boardList.create({
    data: { board_id: board.id, name: 'To Do', position: 1000 },
  });

  const inProgressList = await prisma.boardList.create({
    data: { board_id: board.id, name: 'In Progress', position: 2000 },
  });

  const doneList = await prisma.boardList.create({
    data: { board_id: board.id, name: 'Done', position: 3000 },
  });

  console.log('✅ Board lists created');

  // ── Demo Board Labels ────────────────────────────────────
  const labelHigh = await prisma.label.create({
    data: { board_id: board.id, name: 'High Priority', color: '#ef4444' }, // Red
  });

  const labelFeature = await prisma.label.create({
    data: { board_id: board.id, name: 'Feature', color: '#3b82f6' }, // Blue
  });

  const labelBug = await prisma.label.create({
    data: { board_id: board.id, name: 'Bug', color: '#eab308' }, // Yellow
  });

  console.log('✅ Board labels created');

  // ── Demo Cards ───────────────────────────────────────────
  // Card 1 (Done)
  const card1 = await prisma.card.create({
    data: {
      list_id: doneList.id,
      board_id: board.id,
      title: 'Setup project repository',
      description: 'Initialize git repository, set up husky, ESLint, prettier, and CI/CD pipelines',
      status: CardStatus.completed,
      priority: CardPriority.high,
      position: 1000,
      created_by: pm.id,
      completed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      members: {
        create: { user_id: member1.id },
      },
      labels: {
        create: { label_id: labelFeature.id },
      },
    },
  });

  // Checklist for Card 1
  const checklist1 = await prisma.checklist.create({
    data: {
      card_id: card1.id,
      title: 'Setup Checklist',
      position: 1000,
      items: {
        create: [
          { title: 'Initialize Git & repository configuration', position: 1000, is_completed: true, completed_at: new Date() },
          { title: 'Configure ESLint & Prettier rules', position: 2000, is_completed: true, completed_at: new Date() },
          { title: 'Setup GitHub Actions CI pipeline', position: 3000, is_completed: true, completed_at: new Date() },
        ],
      },
    },
  });

  // Card 2 (In Progress)
  const card2 = await prisma.card.create({
    data: {
      list_id: inProgressList.id,
      board_id: board.id,
      title: 'Build Authentication APIs',
      description: 'JWT authorization flow including signup, login, refresh token, and roles checks',
      status: CardStatus.in_progress,
      priority: CardPriority.high,
      position: 1000,
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days in future
      created_by: pm.id,
      members: {
        create: { user_id: member2.id },
      },
      labels: {
        create: { label_id: labelHigh.id },
      },
    },
  });

  // Comment on Card 2
  await prisma.comment.create({
    data: {
      card_id: card2.id,
      user_id: member1.id,
      content: 'I will help with the frontend integration tests once this is ready!',
    },
  });

  // Card 3 (Todo)
  const card3 = await prisma.card.create({
    data: {
      list_id: todoList.id,
      board_id: board.id,
      title: 'Integrate Stripe Payment Gateway',
      description: 'Configure webhooks, handle successful checkouts, and manage subscription webhooks',
      status: CardStatus.todo,
      priority: CardPriority.high,
      position: 1000,
      due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      created_by: pm.id,
      members: {
        create: { user_id: member2.id },
      },
      labels: {
        create: [
          { label_id: labelFeature.id },
          { label_id: labelHigh.id },
        ],
      },
    },
  });

  console.log('✅ Cards, checklists, and comments created');

  // ── Starred Board ────────────────────────────────────────
  await prisma.starredBoard.create({
    data: {
      user_id: pm.id,
      board_id: board.id,
    },
  });

  // ── Activity Logs ────────────────────────────────────────
  await prisma.activityLog.createMany({
    data: [
      {
        user_id: pm.id,
        board_id: board.id,
        action_type: 'created',
        entity_type: 'board',
        entity_id: board.id,
        description: `created board "${board.name}"`,
      },
      {
        user_id: pm.id,
        board_id: board.id,
        action_type: 'member_added',
        entity_type: 'board',
        entity_id: board.id,
        description: `added John Smith to board`,
      },
      {
        user_id: member1.id,
        board_id: board.id,
        card_id: card1.id,
        action_type: 'created',
        entity_type: 'card',
        entity_id: card1.id,
        description: `created card "${card1.title}"`,
      },
    ],
  });

  console.log('✅ Activity logs created');
  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Demo Credentials:');
  console.log('  Admin:          admin@demo.com / Admin@123');
  console.log('  Project Manager: pm@demo.com   / PM@123456');
  console.log('  Team Member:    member@demo.com / Member@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
