import mongoose from 'mongoose';
import Expert from '../models/Expert.js';
import { connectDB } from '../config/db.js';
import { makeSlotDateTime } from '../services/expertBookingService.js';

const demoExperts = [
  { name: 'Demo Doctor One', role: 'doctor', specialization: 'General health', experienceYears: 8, fees: 700, rating: 4.7 },
  { name: 'Demo Dietitian One', role: 'dietitian', specialization: 'Clinical nutrition', experienceYears: 6, fees: 600, rating: 4.8 },
  { name: 'Demo Doctor Two', role: 'doctor', specialization: 'Preventive care', experienceYears: 12, fees: 900, rating: 4.9 },
  { name: 'Demo Dietitian Two', role: 'dietitian', specialization: 'Sports nutrition', experienceYears: 5, fees: 500, rating: 4.6 },
  { name: 'Demo Dietitian Three', role: 'dietitian', specialization: 'Diabetes nutrition', experienceYears: 10, fees: 800, rating: 4.8 },
];

function dateInIndia(daysAhead) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

async function seedExperts() {
  await connectDB();
  const dates = [dateInIndia(1), dateInIndia(2), dateInIndia(3)];
  for (const [index, expert] of demoExperts.entries()) {
    const availableSlots = [
      makeSlotDateTime(dates[index % dates.length], '10:00'),
      makeSlotDateTime(dates[(index + 1) % dates.length], '14:00'),
      makeSlotDateTime(dates[(index + 2) % dates.length], '16:00'),
    ];
    await Expert.updateOne(
      { name: expert.name },
      { $setOnInsert: { ...expert, availableSlots, availability: availableSlots } },
      { upsert: true, runValidators: true },
    );
  }
  process.stdout.write('Seeded 5 demo experts.\n');
}

seedExperts()
  .catch((error) => {
    process.stderr.write(`Expert seeding failed: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
