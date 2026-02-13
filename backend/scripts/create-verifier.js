import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import User from '../models/User.js';

dotenv.config();

const createVerifier = async () => {
  try {
    await connectDB();

    // Check if verifier already exists
    const existingVerifier = await User.findOne({ email: 'verifier@gfi.com' });
    if (existingVerifier) {
      console.log('⚠️  Verifier user already exists!');
      console.log('Email: verifier@gfi.com');
      console.log('Password: verifier123');
      console.log('\nTo update password, delete the user first or use a different email.');
      process.exit(0);
    }

    console.log('Creating verifier user...');
    const verifier = await User.create({
      email: 'verifier@gfi.com',
      password: 'verifier123',
      name: 'Verifier User',
      role: 'verifier'
    });

    console.log('✅ Verifier user created successfully!');
    console.log('\nLogin credentials:');
    console.log('Email: verifier@gfi.com');
    console.log('Password: verifier123');
    console.log('\nYou can now login as verifier to approve requests from teachers and admins.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating verifier:', error);
    process.exit(1);
  }
};

createVerifier();
