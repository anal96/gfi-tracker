// Script to fix existing time slot records
// Run with: node scripts/fix-time-slots.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import DailyTimeSlot from '../models/DailyTimeSlot.js';

dotenv.config();

const slotDefinitions = {
  '9-10': { label: '9:00 - 10:00', duration: 60 },
  '10-11': { label: '10:00 - 11:00', duration: 60 },
  '11-12': { label: '11:00 - 12:00', duration: 60 },
  '12-13': { label: '12:00 - 13:00', duration: 60 },
  '13-14': { label: '13:00 - 14:00', duration: 60 },
  '14-15': { label: '14:00 - 15:00', duration: 60 },
  '15-16': { label: '15:00 - 16:00', duration: 60 },
  '16-17': { label: '16:00 - 17:00', duration: 60 },
  '17-18': { label: '17:00 - 18:00', duration: 60 },
  '18-19': { label: '18:00 - 19:00', duration: 60 }
};

async function fixTimeSlots() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gfi-tracker');
    console.log('✅ Connected to MongoDB');

    const allTimeSlots = await DailyTimeSlot.find({});
    console.log(`Found ${allTimeSlots.length} time slot records`);

    for (const record of allTimeSlots) {
      let needsUpdate = false;
      
      // Check for missing slots
      const existingSlotIds = record.slots.map(s => s.slotId);
      const missingSlots = Object.entries(slotDefinitions)
        .filter(([id]) => !existingSlotIds.includes(id))
        .map(([id, def]) => ({
          slotId: id,
          label: def.label,
          duration: def.duration,
          checked: false,
          locked: false
        }));

      if (missingSlots.length > 0) {
        record.slots.push(...missingSlots);
        needsUpdate = true;
        console.log(`  Added ${missingSlots.length} missing slots to record for ${record.date}`);
      }

      // Clear all locked flags
      record.slots.forEach(slot => {
        if (slot.locked) {
          slot.locked = false;
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        await record.save();
        console.log(`  ✅ Fixed record for ${record.date}`);
      }
    }

    console.log('✅ All time slot records fixed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixTimeSlots();
