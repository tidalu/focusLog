import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ids = {
  owner: '01J00000000000000000000000',
  mode: '01J00000000000000000000002',
  category: '01J00000000000000000000003',
  tag: '01J00000000000000000000004'
};

async function main(): Promise<void> {
  await prisma.owner.upsert({
    where: { id: ids.owner },
    update: {},
    create: { id: ids.owner }
  });
  await prisma.focusMode.upsert({
    where: { ownerId_name: { ownerId: ids.owner, name: 'Development focus' } },
    update: {},
    create: {
      id: ids.mode,
      ownerId: ids.owner,
      name: 'Development focus',
      intervalMinutes: 30,
      policy: {},
      version: ids.mode
    }
  });
  await prisma.category.upsert({
    where: { ownerId_name: { ownerId: ids.owner, name: 'Development' } },
    update: {},
    create: { id: ids.category, ownerId: ids.owner, name: 'Development', version: ids.category }
  });
  await prisma.tag.upsert({
    where: { ownerId_name: { ownerId: ids.owner, name: 'seed' } },
    update: {},
    create: { id: ids.tag, ownerId: ids.owner, name: 'seed', version: ids.tag }
  });
}

main().finally(async () => {
  await prisma.$disconnect();
});
