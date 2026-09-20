import { connectDB, disconnectDB } from './config/db';
import { Home } from './modules/homes/home.model';
import { Membership } from './modules/memberships/membership.model';

async function check() {
  await connectDB();
  const homes = await Home.find({}).lean();
  console.log('Homes found:', homes.map(h => ({ id: h._id.toString(), name: h.name, code: h.inviteCode, cycle: h.currentCycle })));

  const memberships = await Membership.find({}).populate('userId', 'name email').lean();
  console.log('Memberships found:', memberships.map(m => ({
    id: m._id.toString(),
    homeId: m.homeId.toString(),
    role: m.role,
    name: (m.userId as any)?.name,
    email: (m.userId as any)?.email,
  })));

  await disconnectDB();
}

check().catch(console.error);
