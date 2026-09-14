import { connectDB, disconnectDB } from './config/db';
import { Home } from './modules/homes/home.model';
import { Membership } from './modules/memberships/membership.model';
import { User } from './modules/users/user.model';
import { Meal } from './modules/meals/meal.model';
import { MealType, MealSlot, GuestMealStatus } from './config/enums';

const MEAL_DATA = [
  { date: '2026-08-01', Abdullah: [0, 0], Nafis: [1, 1], 'Fartin Fuad': [1, 2], Sazid: [0, 0], Bidhan: [1, 1], Rofy: [0, 0] },
  { date: '2026-08-02', Abdullah: [0, 0], Nafis: [1, 1], 'Fartin Fuad': [1, 2], Sazid: [0, 1], Bidhan: [1, 1], Rofy: [0, 0] },
  { date: '2026-08-03', Abdullah: [0, 0], Nafis: [1, 1], 'Fartin Fuad': [1, 2], Sazid: [1, 2], Bidhan: [0, 2], Rofy: [0, 0] },
  { date: '2026-08-04', Abdullah: [0, 0], Nafis: [0, 1], 'Fartin Fuad': [1, 2], Sazid: [1, 1], Bidhan: [1, 1], Rofy: [0, 0] },
  { date: '2026-08-05', Abdullah: [0, 0], Nafis: [0, 1], 'Fartin Fuad': [1, 2], Sazid: [1, 1], Bidhan: [1, 1], Rofy: [0, 0] },
  { date: '2026-08-06', Abdullah: [0, 0], Nafis: [1, 1], 'Fartin Fuad': [1, 2], Sazid: [1, 1], Bidhan: [2, 2], Rofy: [0, 0] },
  { date: '2026-08-07', Abdullah: [0, 0], Nafis: [0, 1], 'Fartin Fuad': [0, 2], Sazid: [0, 2], Bidhan: [0, 1], Rofy: [0, 0] },
  { date: '2026-08-08', Abdullah: [0, 0], Nafis: [0, 1], 'Fartin Fuad': [1, 2], Sazid: [1, 1], Bidhan: [1, 1], Rofy: [0, 0] },
  { date: '2026-08-09', Abdullah: [0, 0], Nafis: [0, 1], 'Fartin Fuad': [0, 2], Sazid: [0, 1], Bidhan: [0, 2], Rofy: [0, 0] },
  { date: '2026-08-10', Abdullah: [0, 0], Nafis: [1, 1], 'Fartin Fuad': [1, 2], Sazid: [1, 1], Bidhan: [0, 1], Rofy: [0, 0] },
  { date: '2026-08-11', Abdullah: [0, 0], Nafis: [0, 1], 'Fartin Fuad': [0, 2], Sazid: [0, 1], Bidhan: [0, 0], Rofy: [0, 0] },
  { date: '2026-08-12', Abdullah: [0, 0], Nafis: [1, 1], 'Fartin Fuad': [1, 2], Sazid: [1, 1], Bidhan: [1, 0], Rofy: [0, 0] },
  { date: '2026-08-13', Abdullah: [0, 0], Nafis: [1, 1], 'Fartin Fuad': [1, 2], Sazid: [1, 1], Bidhan: [0, 0], Rofy: [0, 0] },
  { date: '2026-08-14', Abdullah: [0, 0], Nafis: [1, 1], 'Fartin Fuad': [1, 2], Sazid: [1, 2], Bidhan: [0, 2], Rofy: [0, 0] },
  { date: '2026-08-15', Abdullah: [0, 0], Nafis: [1, 1], 'Fartin Fuad': [1, 2], Sazid: [1, 1], Bidhan: [1, 1], Rofy: [0, 0] },
  { date: '2026-08-16', Abdullah: [0, 0], Nafis: [1, 1], 'Fartin Fuad': [1, 2], Sazid: [1, 1], Bidhan: [1, 1], Rofy: [0, 0] },
  { date: '2026-08-17', Abdullah: [0, 0], Nafis: [1, 1], 'Fartin Fuad': [1, 2], Sazid: [1, 1], Bidhan: [1, 1], Rofy: [0, 0] },
  { date: '2026-08-18', Abdullah: [0, 0], Nafis: [1, 1], 'Fartin Fuad': [1, 2], Sazid: [1, 1], Bidhan: [1, 1], Rofy: [0, 0] },
  { date: '2026-08-19', Abdullah: [0, 0], Nafis: [1, 1], 'Fartin Fuad': [1, 1], Sazid: [2, 2], Bidhan: [1, 1], Rofy: [0, 0] },
  { date: '2026-08-20', Abdullah: [0, 0], Nafis: [1, 1], 'Fartin Fuad': [1, 2], Sazid: [2, 2], Bidhan: [0, 2], Rofy: [0, 0] },
  { date: '2026-08-21', Abdullah: [0, 0], Nafis: [1, 1], 'Fartin Fuad': [1, 2], Sazid: [1, 1], Bidhan: [0, 1], Rofy: [0, 0] },
];

async function seedAugustMeals() {
  await connectDB();

  const home = await Home.findOne({});
  if (!home) throw new Error('No home found');

  // Set home currentCycle to '2026-08'
  home.currentCycle = '2026-08';
  await home.save();

  const memberships = await Membership.find({ homeId: home._id }).populate<{ userId: { _id: any; name: string } }>('userId', 'name').lean();
  
  // Find admin membership
  const adminMembership = memberships.find(m => m.role === 'admin');
  if (adminMembership && adminMembership.userId) {
    if (adminMembership.userId.name === 'Tamimur Rahaman') {
      await User.updateOne({ _id: adminMembership.userId._id }, { name: 'Fartin Fuad' });
      adminMembership.userId.name = 'Fartin Fuad';
    }
  }

  // Create member lookup map by name
  const memberMap = new Map<string, any>();
  for (const m of memberships) {
    if (m.userId?.name) {
      memberMap.set(m.userId.name, m);
    }
  }

  console.log('Member lookup map:', Array.from(memberMap.keys()));

  // Clear existing meals for cycle 2026-08
  await Meal.deleteMany({ homeId: home._id, cycle: '2026-08' });

  const adminId = adminMembership?._id || memberships[0]._id;
  const docsToInsert = [];
  const totals: Record<string, [number, number]> = {};

  for (const name of Array.from(memberMap.keys())) {
    totals[name] = [0, 0];
  }

  for (const entry of MEAL_DATA) {
    const cycle = '2026-08';
    const date = entry.date as string;

    const memberKeys = ['Abdullah', 'Nafis', 'Fartin Fuad', 'Sazid', 'Bidhan', 'Rofy'];
    for (const name of memberKeys) {
      const counts = entry[name as keyof typeof entry] as number[];
      if (!counts) continue;
      const lunchCount = counts[0];
      const dinnerCount = counts[1];

      const member = memberMap.get(name);
      if (!member) continue;

      totals[name][0] += lunchCount;
      totals[name][1] += dinnerCount;

      if (lunchCount === 0 && dinnerCount === 0) continue;

      // Normal meal record (covers up to 1 lunch and 1 dinner)
      const normalLunch = lunchCount > 0;
      const normalDinner = dinnerCount > 0;
      const normalCount = (normalLunch ? 1 : 0) + (normalDinner ? 1 : 0);

      docsToInsert.push({
        homeId: home._id,
        membershipId: member._id,
        date,
        cycle,
        type: MealType.Normal,
        slots: {
          breakfast: false,
          lunch: normalLunch,
          dinner: normalDinner,
        },
        count: normalCount,
        createdBy: adminId,
      });

      // Guest meal records for extra lunch (lunchCount > 1)
      for (let i = 1; i < lunchCount; i++) {
        docsToInsert.push({
          homeId: home._id,
          membershipId: member._id,
          date,
          cycle,
          type: MealType.Guest,
          slot: MealSlot.Lunch,
          count: 1,
          guestStatus: GuestMealStatus.Approved,
          requestedByMembershipId: member._id,
          createdBy: adminId,
        });
      }

      // Guest meal records for extra dinner (dinnerCount > 1)
      for (let i = 1; i < dinnerCount; i++) {
        docsToInsert.push({
          homeId: home._id,
          membershipId: member._id,
          date,
          cycle,
          type: MealType.Guest,
          slot: MealSlot.Dinner,
          count: 1,
          guestStatus: GuestMealStatus.Approved,
          requestedByMembershipId: member._id,
          createdBy: adminId,
        });
      }
    }
  }

  await Meal.insertMany(docsToInsert);

  console.log('✅ August 2026 meals successfully seeded!');
  console.log('Totals Verification for August 2026 (2026-08):');
  for (const [name, [l, d]] of Object.entries(totals)) {
    console.log(`  ${name}: Lunch = ${l}, Dinner = ${d}, Total = ${l + d}`);
  }

  await disconnectDB();
}

seedAugustMeals().catch((err) => {
  console.error('Error seeding August meals:', err);
  process.exit(1);
});
