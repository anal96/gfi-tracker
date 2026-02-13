import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    try {
      // Find all teachers
      const teachers = await User.find({ role: 'teacher' }).select('name email avatar');
      console.log('--- Teachers with avatar info ---');
      teachers.forEach(t => {
        const hasAvatar = t.avatar && t.avatar.length > 0;
        console.log(`Name: ${t.name}`);
        console.log(`Email: ${t.email}`);
        console.log(`Has Avatar: ${hasAvatar}`);
        if (hasAvatar) {
          console.log(`Avatar Preview: ${t.avatar.substring(0, 50)}...`);
        }
        console.log('---');
      });
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
