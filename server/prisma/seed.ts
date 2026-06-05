/**
 * Seed data for local dev.
 * Run: pnpm prisma:seed
 *
 * Idempotent — uses upsert with stable IDs, safe to re-run.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const alice = await prisma.user.upsert({
    where: { openid: 'demo-openid-alice' },
    update: {},
    create: {
      openid: 'demo-openid-alice',
      nickname: 'Alice',
      avatar: 'https://i.pravatar.cc/150?img=1',
      school: 'MIT',
      major: 'CS',
      grade: '2026',
      bio: '爱打羽毛球的留学生',
    },
  });

  const bob = await prisma.user.upsert({
    where: { openid: 'demo-openid-bob' },
    update: {},
    create: {
      openid: 'demo-openid-bob',
      nickname: 'Bob',
      avatar: 'https://i.pravatar.cc/150?img=2',
      school: 'Stanford',
      major: 'EE',
      grade: '2025',
    },
  });

  const carol = await prisma.user.upsert({
    where: { openid: 'demo-openid-carol' },
    update: {},
    create: {
      openid: 'demo-openid-carol',
      nickname: 'Carol',
      avatar: 'https://i.pravatar.cc/150?img=3',
      school: 'NYU',
      major: 'Design',
      grade: '2027',
      bio: '桌游搭子 🎲',
    },
  });

  const now = new Date();
  const tomorrow = new Date(now.getTime() + ONE_DAY_MS);
  const dayAfter = new Date(now.getTime() + 2 * ONE_DAY_MS);

  // Sports demo activity
  const sports = await prisma.activity.upsert({
    where: { id: 'demo-activity-sports' },
    update: {},
    create: {
      id: 'demo-activity-sports',
      creatorId: alice.id,
      type: 'SPORTS',
      title: '周末羽毛球 3v3 (新手友好)',
      description: '求 3-4 个搭子，球馆空调够冷，自带球拍。',
      locationName: 'XX 羽毛球馆',
      locationAddr: '北京市海淀区中关村大街 1 号',
      locationLat: 39.9842,
      locationLng: 116.3074,
      startTime: tomorrow,
      endTime: new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000),
      maxParticipants: 8,
      currentCount: 2,
      tags: ['羽毛球', '新手友好'],
      status: 'RECRUITING',
      contentCheck: 'PASS',
    },
  });

  // Board game demo activity
  const boardGame = await prisma.activity.upsert({
    where: { id: 'demo-activity-boardgame' },
    update: {},
    create: {
      id: 'demo-activity-boardgame',
      creatorId: carol.id,
      type: 'BOARD_GAME',
      title: '狼人杀夜场（会带新人局）',
      description: '已经凑齐 4 人，再来 2-4 个。地点在静安寺附近的桌游吧。',
      locationName: '静安寺桌游吧',
      locationAddr: '上海市静安区南京西路 1788 号',
      locationLat: 31.2236,
      locationLng: 121.4456,
      startTime: dayAfter,
      endTime: new Date(dayAfter.getTime() + 4 * 60 * 60 * 1000),
      maxParticipants: 10,
      currentCount: 4,
      tags: ['狼人杀', '桌游'],
      status: 'RECRUITING',
      contentCheck: 'PASS',
    },
  });

  // Signups — pre-populated so the demo looks alive.
  const signups = [
    { activityId: sports.id, userId: alice.id, status: 'APPROVED' as const },
    { activityId: sports.id, userId: bob.id, status: 'APPROVED' as const },
    { activityId: boardGame.id, userId: carol.id, status: 'APPROVED' as const },
    { activityId: boardGame.id, userId: bob.id, status: 'APPROVED' as const },
  ];
  for (const s of signups) {
    await prisma.signup.upsert({
      where: { activityId_userId: { activityId: s.activityId, userId: s.userId } },
      update: {},
      create: s,
    });
  }

  console.info('✅ Seed completed');
  console.info({
    users: [alice.id, bob.id, carol.id],
    activities: [sports.id, boardGame.id],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
