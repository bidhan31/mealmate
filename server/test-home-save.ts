import mongoose from 'mongoose';
import { Home } from './src/modules/homes/home.model';
import { env } from './src/config/env';

mongoose.connect(env.MONGODB_URI).then(async () => {
  try {
    const home = await Home.findOne();
    if (!home) return console.log('no home');
    home.closedMealDates.push('2026-07-27');
    await home.save();
    console.log('Saved successfully');
  } catch (err: any) {
    console.error('Validation error:', err.message);
    if (err.errors) console.error(err.errors);
  }
  process.exit(0);
});
