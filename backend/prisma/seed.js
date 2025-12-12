const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getIsoDate = (daysOffset) => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString();
};


const demoPassword = "password123";
const usersData = [
    { utorid: 'superuser01', name: 'Althea Super', email: 'althea.su@utoronto.ca', role: 'superuser', points: 10000, verified: true },
    { utorid: 'manager01', name: 'Ben Manager', email: 'ben.mgr@utoronto.ca', role: 'manager', points: 5000, verified: true },
    { utorid: 'manager02', name: 'Chris Manager', email: 'chris.mgr@utoronto.ca', role: 'manager', points: 4500, verified: true },
    { utorid: 'cashier01', name: 'Diana Cash', email: 'diana.cash@utoronto.ca', role: 'cashier', points: 2000, verified: true },
    { utorid: 'cashier02', name: 'Evan Cash', email: 'evan.cash@utoronto.ca', role: 'cashier', points: 1800, verified: true },
    
    { utorid: 'reguser01', name: 'Fiona Reg', email: 'fiona.reg@utoronto.ca', role: 'regular', points: 1500, verified: true },
    { utorid: 'reguser02', name: 'Gary Reg', email: 'gary.reg@utoronto.ca', role: 'regular', points: 1200, verified: false },
    { utorid: 'reguser03', name: 'Holly Reg', email: 'holly.reg@utoronto.ca', role: 'regular', points: 1000, verified: true },
    { utorid: 'reguser04', name: 'Ian Reg', email: 'ian.reg@utoronto.ca', role: 'regular', points: 800, verified: true },
    { utorid: 'reguser05', name: 'Jenna Reg', email: 'jenna.reg@utoronto.ca', role: 'regular', points: 600, verified: true },
    { utorid: 'reguser06', name: 'Kyle Reg', email: 'kyle.reg@utoronto.ca', role: 'regular', points: 400, verified: true },
    { utorid: 'reguser07', name: 'Lia Reg', email: 'lia.reg@utoronto.ca', role: 'regular', points: 200, verified: true },
    { utorid: 'reguser08', utorid: 'reguser08', name: 'Mark Reg', email: 'mark.reg@utoronto.ca', role: 'regular', points: 100, verified: true },
    { utorid: 'reguser09', name: 'Nora Reg', email: 'nora.reg@utoronto.ca', role: 'regular', points: 50, verified: true },
    { utorid: 'reguser10', name: 'Owen Reg', email: 'owen.reg@utoronto.ca', role: 'regular', points: 10, verified: true },
];

const promotionsData = [
    { name: 'Welcome Week Bonus', description: 'Get 2x points on your first purchase.', type: 'automatic', rate: 1.0, minSpending: 10, startTime: getIsoDate(-30), endTime: getIsoDate(5), isOneTime: true },
    { name: 'Black Friday Sale', description: 'Flat 500 bonus points on any purchase.', type: 'one-time', points: 500, minSpending: 50, startTime: getIsoDate(-10), endTime: getIsoDate(30), isOneTime: true },
    { name: 'Daily Double', description: 'Double your points every Monday.', type: 'automatic', rate: 1.0, startTime: getIsoDate(-100), endTime: getIsoDate(100), isOneTime: false },
    { name: 'Holiday Special', description: '20% extra on spending over $100.', type: 'automatic', rate: 0.2, minSpending: 100, startTime: getIsoDate(5), endTime: getIsoDate(40), isOneTime: false },
    { name: 'Last Chance', description: '100 flat points, expiring soon.', type: 'one-time', points: 100, startTime: getIsoDate(-5), endTime: getIsoDate(1), isOneTime: true },
    { name: 'Big Spender', description: '200 flat points bonus on any purchase.', type: 'automatic', points: 200, minSpending: 25, startTime: getIsoDate(-10), endTime: getIsoDate(50), isOneTime: false },
];

const eventsData = [
    { name: 'CS Pizza Night', location: 'Bahen Hall', description: 'Free pizza and networking.', capacity: 100, pointsRemain: 1000, pointsAwarded: 0, published: true, startTime: getIsoDate(1), endTime: getIsoDate(2) },
    { name: 'Prisma Workshop', location: 'Online Zoom', description: 'Deep dive into Prisma ORM.', capacity: 50, pointsRemain: 500, pointsAwarded: 500, published: true, startTime: getIsoDate(-7), endTime: getIsoDate(-6) },
    { name: 'Final Project Demo Day', location: 'Exam Centre', description: 'Present your work.', capacity: 200, pointsRemain: 2000, pointsAwarded: 0, published: true, startTime: getIsoDate(10), endTime: getIsoDate(11) },
    { name: 'Unpublished Meeting', location: 'Secret Room', description: 'Internal meeting for organizers.', capacity: 10, pointsRemain: 100, pointsAwarded: 0, published: false, startTime: getIsoDate(3), endTime: getIsoDate(4) },
    { name: 'Code Review Session', location: 'Robarts Library', description: 'Peer code review.', capacity: 30, pointsRemain: 300, pointsAwarded: 100, published: true, startTime: getIsoDate(-2), endTime: getIsoDate(-1) }, 
    { name: 'Graduation Gala', location: 'Convocation Hall', description: 'Celebrate!', capacity: 500, pointsRemain: 5000, pointsAwarded: 0, published: true, startTime: getIsoDate(30), endTime: getIsoDate(31) },
];

async function main() {
    console.log(`\n--- Starting Seed Script for ScoreCart ---`);

    await prisma.transaction.deleteMany();
    await prisma.usage.deleteMany();
    await prisma.event.deleteMany();
    await prisma.promotion.deleteMany();
    await prisma.user.deleteMany();
    console.log(`1. Cleared all existing data from the database.`);

    const createdUsers = await Promise.all(usersData.map(data => 
        prisma.user.create({ data: { ...data, password: demoPassword } })
    ));
    console.log(`2. Created ${createdUsers.length} users, including all required roles.`);
    
    const usersMap = new Map(createdUsers.map(u => [u.utorid, u]));
    const usersById = new Map(createdUsers.map(u => [u.id, u.utorid]));
    const su = usersMap.get('superuser01');
    const mgr1 = usersMap.get('manager01');
    const cash1 = usersMap.get('cashier01');
    const reg1 = usersMap.get('reguser01');
    const reg2 = usersMap.get('reguser02');
    const reg3 = usersMap.get('reguser03');
    const reg4 = usersMap.get('reguser04');


    const createdEvents = await Promise.all(eventsData.map(data => 
        prisma.event.create({
            data: { 
                ...data,
                organizers: { connect: [{ id: mgr1.id }] },
                guests: { connect: [
                    { id: reg1.id }, { id: reg2.id }, { id: reg3.id }, { id: reg4.id }
                ]}
            }
        })
    ));
    console.log(`3. Created ${createdEvents.length} events, linked to Manager01.`);

    const promoMap = {};
    const eventsMap = {};
    createdEvents.forEach(e => eventsMap[e.name] = e);
    
    const createdPromotions = await Promise.all(promotionsData.map(data => 
        prisma.promotion.create({ data })
    ));
    createdPromotions.forEach(p => promoMap[p.name] = p);
    console.log(`4. Created ${createdPromotions.length} promotions.`);

    await prisma.usage.create({
        data: {
            userId: reg1.id,
            promotionId: promoMap['Welcome Week Bonus'].id,
        }
    });
    console.log(`5. Marked 'Welcome Week Bonus' as used by reguser01.`);


    const createPurchases = (count, utorid, spent, promotions = []) => {
        const transactions = [];
        for (let i = 0; i < count; i++) {
            transactions.push(prisma.transaction.create({
                data: {
                    type: 'purchase', utorid, createdBy: cash1.utorid, suspicious: false,
                    spent: spent + i, amount: Math.round((spent + i) / 0.25), 
                    promotions: { connect: promotions.map(p => ({ id: p.id })) }
                }
            }));
        }
        return transactions;
    };


    const purchaseTxs = await Promise.all([
        ...createPurchases(5, reg1.utorid, 10.00),
        ...createPurchases(5, reg2.utorid, 15.00, [promoMap['Daily Double']]),
        ...createPurchases(5, reg3.utorid, 50.00, [promoMap['Welcome Week Bonus']]),
    ]);
    console.log(`6A. Created 15 Purchase transactions.`);

    const redemptionTxs = await Promise.all([
        prisma.transaction.create({ data: { type: 'redemption', utorid: reg1.utorid, createdBy: reg1.utorid, amount: 200, processed: false } }),
        prisma.transaction.create({ data: { type: 'redemption', utorid: reg2.utorid, createdBy: reg2.utorid, amount: 500, processed: false } }),
        prisma.transaction.create({ data: { type: 'redemption', utorid: reg3.utorid, createdBy: reg3.utorid, amount: 100, processed: true, processedBy: cash1.utorid } }),
        prisma.transaction.create({ data: { type: 'redemption', utorid: reg4.utorid, createdBy: reg4.utorid, amount: 150, processed: false } }),
        prisma.transaction.create({ data: { type: 'redemption', utorid: reg1.utorid, createdBy: reg1.utorid, amount: 250, processed: false } }),
    ]);
    console.log(`6B. Created 5 Redemption transactions.`);
    
    const transferTxs = await Promise.all([
        prisma.transaction.create({ data: { type: 'transfer', utorid: reg1.utorid, createdBy: reg1.utorid, amount: -100, relatedId: reg2.id, remark: 'Gift' } }),
        prisma.transaction.create({ data: { type: 'transfer', utorid: reg2.utorid, createdBy: reg1.utorid, amount: 100, relatedId: reg1.id, remark: 'Gift' } }),
        prisma.transaction.create({ data: { type: 'transfer', utorid: reg3.utorid, createdBy: reg3.utorid, amount: -50, relatedId: reg4.id } }),
        prisma.transaction.create({ data: { type: 'transfer', utorid: reg4.utorid, createdBy: reg3.utorid, amount: 50, relatedId: reg3.id } }),
        prisma.transaction.create({ data: { type: 'transfer', utorid: reg1.utorid, createdBy: reg1.utorid, amount: -10, relatedId: mgr1.id } }),
    ]);
    console.log(`6C. Created 5 Transfer transactions (10 total entries, 5 unique events).`);
    
    const adjustmentTxs = await Promise.all([
        prisma.transaction.create({ data: { type: 'adjustment', utorid: reg1.utorid, createdBy: mgr1.utorid, amount: -50, relatedId: purchaseTxs[0].id, remark: 'Refund for Purchase #1' } }),
        prisma.transaction.create({ data: { type: 'adjustment', utorid: reg2.utorid, createdBy: su.utorid, amount: 200, relatedId: redemptionTxs[0].id, remark: 'Bonus Correction' } }),
        prisma.transaction.create({ data: { type: 'adjustment', utorid: reg1.utorid, createdBy: mgr1.utorid, amount: 100, relatedId: transferTxs[0].id } }),
        prisma.transaction.create({ data: { type: 'adjustment', utorid: reg3.utorid, createdBy: mgr1.utorid, amount: -100, relatedId: null, suspicious: true, remark: 'High Risk Flag' } }), 
        prisma.transaction.create({ data: { type: 'adjustment', utorid: reg4.utorid, createdBy: su.utorid, amount: 50, relatedId: null } }),
    ]);
    console.log(`6D. Created 5 Adjustment transactions.`);
    
    const eventTxs = await Promise.all([
        prisma.transaction.create({ data: { type: 'event', utorid: reg1.utorid, createdBy: mgr1.utorid, amount: 100, eventId: eventsMap['Prisma Workshop'].id, remark: 'Workshop Attendance' } }),
        prisma.transaction.create({ data: { type: 'event', utorid: reg2.utorid, createdBy: mgr1.utorid, amount: 100, eventId: eventsMap['Prisma Workshop'].id, remark: 'Workshop Attendance' } }),
        prisma.transaction.create({ data: { type: 'event', utorid: reg3.utorid, createdBy: mgr1.utorid, amount: 50, eventId: eventsMap['Code Review Session'].id, remark: 'Review Session' } }),
        prisma.transaction.create({ data: { type: 'event', utorid: reg4.utorid, createdBy: mgr1.utorid, amount: 50, eventId: eventsMap['Code Review Session'].id, remark: 'Review Session' } }),
        prisma.transaction.create({ data: { type: 'event', utorid: reg1.utorid, createdBy: mgr1.utorid, amount: 50, eventId: eventsMap['Code Review Session'].id, remark: 'Review Session' } }),
    ]);
    console.log(`6E. Created 5 Event transactions. (Total: 35 transactions)`);
    

    await prisma.transaction.update({
        where: { id: purchaseTxs[1].id },
        data: { suspicious: true }
    });

    console.log(`\n--- Seeding Complete ---`);
    console.log(`Demo Password for all users is: ${demoPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });