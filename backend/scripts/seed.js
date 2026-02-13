import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Subject from '../models/Subject.js';
import Unit from '../models/Unit.js';
import Batch from '../models/Batch.js';

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();

    // Clear existing data
    await Unit.deleteMany({});
    await Subject.deleteMany({});
    await Batch.deleteMany({});
    await User.deleteMany({});

    console.log('Creating admin user...');
    const admin = await User.create({
      email: 'admin@gfi.com',
      password: 'admin123',
      name: 'Admin User',
      role: 'admin'
    });

    console.log('Creating teacher users...');
    const teacher1 = await User.create({
      email: 'teacher1@gfi.com',
      password: 'teacher123',
      name: 'Dr. Sarah Johnson',
      role: 'teacher'
    });

    const teacher2 = await User.create({
      email: 'teacher2@gfi.com',
      password: 'teacher123',
      name: 'Prof. Michael Chen',
      role: 'teacher'
    });

    console.log('Creating verifier user...');
    const verifier = await User.create({
      email: 'verifier@gfi.com',
      password: 'verifier123',
      name: 'Verifier User',
      role: 'verifier'
    });

    console.log('Creating subjects and units...');
    
    // Teacher 1 subjects
    const mathSubject = await Subject.create({
      name: 'Mathematics',
      color: 'from-blue-500 to-indigo-500',
      teacher: teacher1._id
    });

    const physicsSubject = await Subject.create({
      name: 'Physics',
      color: 'from-purple-500 to-pink-500',
      teacher: teacher1._id
    });

    const chemistrySubject = await Subject.create({
      name: 'Chemistry',
      color: 'from-teal-500 to-emerald-500',
      teacher: teacher1._id
    });

    // Math units
    const mathUnit1 = await Unit.create({
      name: 'Unit 1: Algebra Basics',
      subject: mathSubject._id,
      order: 1
    });
    const mathUnit2 = await Unit.create({
      name: 'Unit 2: Linear Equations',
      subject: mathSubject._id,
      order: 2
    });
    const mathUnit3 = await Unit.create({
      name: 'Unit 3: Quadratic Functions',
      subject: mathSubject._id,
      order: 3
    });

    // Physics units
    const physicsUnit1 = await Unit.create({
      name: 'Unit 1: Motion & Forces',
      subject: physicsSubject._id,
      order: 1
    });
    const physicsUnit2 = await Unit.create({
      name: 'Unit 2: Energy & Work',
      subject: physicsSubject._id,
      order: 2
    });
    const physicsUnit3 = await Unit.create({
      name: 'Unit 3: Thermodynamics',
      subject: physicsSubject._id,
      order: 3
    });

    // Chemistry units
    const chemUnit1 = await Unit.create({
      name: 'Unit 1: Atomic Structure',
      subject: chemistrySubject._id,
      order: 1
    });
    const chemUnit2 = await Unit.create({
      name: 'Unit 2: Chemical Bonding',
      subject: chemistrySubject._id,
      order: 2
    });
    const chemUnit3 = await Unit.create({
      name: 'Unit 3: Reactions',
      subject: chemistrySubject._id,
      order: 3
    });

    // Update subjects with units
    mathSubject.units = [mathUnit1._id, mathUnit2._id, mathUnit3._id];
    await mathSubject.save();

    physicsSubject.units = [physicsUnit1._id, physicsUnit2._id, physicsUnit3._id];
    await physicsSubject.save();

    chemistrySubject.units = [chemUnit1._id, chemUnit2._id, chemUnit3._id];
    await chemistrySubject.save();

    // Update teacher with subjects
    teacher1.subjects = [mathSubject._id, physicsSubject._id, chemistrySubject._id];
    await teacher1.save();

    // Teacher 2 subjects
    const bioSubject = await Subject.create({
      name: 'Biology',
      color: 'from-green-500 to-lime-500',
      teacher: teacher2._id
    });

    const historySubject = await Subject.create({
      name: 'History',
      color: 'from-amber-500 to-orange-500',
      teacher: teacher2._id
    });

    // Biology units
    const bioUnit1 = await Unit.create({
      name: 'Unit 1: Cell Biology',
      subject: bioSubject._id,
      order: 1
    });
    const bioUnit2 = await Unit.create({
      name: 'Unit 2: Genetics',
      subject: bioSubject._id,
      order: 2
    });

    // History units
    const histUnit1 = await Unit.create({
      name: 'Unit 1: Ancient Civilizations',
      subject: historySubject._id,
      order: 1
    });

    bioSubject.units = [bioUnit1._id, bioUnit2._id];
    await bioSubject.save();

    historySubject.units = [histUnit1._id];
    await historySubject.save();

    teacher2.subjects = [bioSubject._id, historySubject._id];
    await teacher2.save();

    console.log('Creating batches...');
    
    // Create batches
    const morningBatch = await Batch.create({
      name: 'Morning Batch',
      year: '2024',
      description: 'Morning session batch for 2024',
      students: [],
      createdBy: admin._id
    });

    const afternoonBatch = await Batch.create({
      name: 'Afternoon Batch',
      year: '2024',
      description: 'Afternoon session batch for 2024',
      students: [],
      createdBy: admin._id
    });

    const eveningBatch = await Batch.create({
      name: 'Evening Batch',
      year: '2024',
      description: 'Evening session batch for 2024',
      students: [],
      createdBy: admin._id
    });

    // Assign subjects to batches
    mathSubject.batch = morningBatch._id;
    await mathSubject.save();

    physicsSubject.batch = morningBatch._id;
    await physicsSubject.save();

    chemistrySubject.batch = morningBatch._id;
    await chemistrySubject.save();

    bioSubject.batch = afternoonBatch._id;
    await bioSubject.save();

    historySubject.batch = eveningBatch._id;
    await historySubject.save();

    console.log('Creating BCA, BCOM, and CA batches with subjects...');
    
    // Create BCA Batch
    const bcaBatch = await Batch.create({
      name: 'BCA',
      year: '2024',
      description: 'Bachelor of Computer Applications',
      students: [],
      createdBy: admin._id
    });

    // BCA Subjects and Units
    const bcaMath = await Subject.create({
      name: 'Mathematics',
      color: 'from-blue-500 to-blue-600',
      teacher: teacher1._id,
      batch: bcaBatch._id
    });
    const bcaMathUnit1 = await Unit.create({ name: 'Algebra', subject: bcaMath._id, order: 1 });
    const bcaMathUnit2 = await Unit.create({ name: 'Calculus', subject: bcaMath._id, order: 2 });
    const bcaMathUnit3 = await Unit.create({ name: 'Statistics', subject: bcaMath._id, order: 3 });
    bcaMath.units = [bcaMathUnit1._id, bcaMathUnit2._id, bcaMathUnit3._id];
    await bcaMath.save();

    const bcaC = await Subject.create({
      name: 'Programming in C',
      color: 'from-green-500 to-green-600',
      teacher: teacher1._id,
      batch: bcaBatch._id
    });
    const bcaCUnit1 = await Unit.create({ name: 'Basics of C', subject: bcaC._id, order: 1 });
    const bcaCUnit2 = await Unit.create({ name: 'Functions', subject: bcaC._id, order: 2 });
    const bcaCUnit3 = await Unit.create({ name: 'Pointers', subject: bcaC._id, order: 3 });
    bcaC.units = [bcaCUnit1._id, bcaCUnit2._id, bcaCUnit3._id];
    await bcaC.save();

    const bcaDS = await Subject.create({
      name: 'Data Structures',
      color: 'from-purple-500 to-purple-600',
      teacher: teacher1._id,
      batch: bcaBatch._id
    });
    const bcaDSUnit1 = await Unit.create({ name: 'Arrays', subject: bcaDS._id, order: 1 });
    const bcaDSUnit2 = await Unit.create({ name: 'Linked Lists', subject: bcaDS._id, order: 2 });
    const bcaDSUnit3 = await Unit.create({ name: 'Trees', subject: bcaDS._id, order: 3 });
    bcaDS.units = [bcaDSUnit1._id, bcaDSUnit2._id, bcaDSUnit3._id];
    await bcaDS.save();

    const bcaDB = await Subject.create({
      name: 'Database Management',
      color: 'from-orange-500 to-orange-600',
      teacher: teacher1._id,
      batch: bcaBatch._id
    });
    const bcaDBUnit1 = await Unit.create({ name: 'SQL Basics', subject: bcaDB._id, order: 1 });
    const bcaDBUnit2 = await Unit.create({ name: 'Normalization', subject: bcaDB._id, order: 2 });
    const bcaDBUnit3 = await Unit.create({ name: 'Transactions', subject: bcaDB._id, order: 3 });
    bcaDB.units = [bcaDBUnit1._id, bcaDBUnit2._id, bcaDBUnit3._id];
    await bcaDB.save();

    const bcaWeb = await Subject.create({
      name: 'Web Development',
      color: 'from-pink-500 to-pink-600',
      teacher: teacher1._id,
      batch: bcaBatch._id
    });
    const bcaWebUnit1 = await Unit.create({ name: 'HTML/CSS', subject: bcaWeb._id, order: 1 });
    const bcaWebUnit2 = await Unit.create({ name: 'JavaScript', subject: bcaWeb._id, order: 2 });
    const bcaWebUnit3 = await Unit.create({ name: 'React', subject: bcaWeb._id, order: 3 });
    bcaWeb.units = [bcaWebUnit1._id, bcaWebUnit2._id, bcaWebUnit3._id];
    await bcaWeb.save();

    const bcaSE = await Subject.create({
      name: 'Software Engineering',
      color: 'from-indigo-500 to-indigo-600',
      teacher: teacher1._id,
      batch: bcaBatch._id
    });
    const bcaSEUnit1 = await Unit.create({ name: 'SDLC', subject: bcaSE._id, order: 1 });
    const bcaSEUnit2 = await Unit.create({ name: 'Design Patterns', subject: bcaSE._id, order: 2 });
    const bcaSEUnit3 = await Unit.create({ name: 'Testing', subject: bcaSE._id, order: 3 });
    bcaSE.units = [bcaSEUnit1._id, bcaSEUnit2._id, bcaSEUnit3._id];
    await bcaSE.save();

    // Create BCOM Batch
    const bcomBatch = await Batch.create({
      name: 'BCOM',
      year: '2024',
      description: 'Bachelor of Commerce',
      students: [],
      createdBy: admin._id
    });

    // BCOM Subjects and Units
    const bcomAcc = await Subject.create({
      name: 'Accounting',
      color: 'from-blue-500 to-blue-600',
      teacher: teacher2._id,
      batch: bcomBatch._id
    });
    const bcomAccUnit1 = await Unit.create({ name: 'Financial Accounting', subject: bcomAcc._id, order: 1 });
    const bcomAccUnit2 = await Unit.create({ name: 'Cost Accounting', subject: bcomAcc._id, order: 2 });
    const bcomAccUnit3 = await Unit.create({ name: 'Management Accounting', subject: bcomAcc._id, order: 3 });
    bcomAcc.units = [bcomAccUnit1._id, bcomAccUnit2._id, bcomAccUnit3._id];
    await bcomAcc.save();

    const bcomEco = await Subject.create({
      name: 'Business Economics',
      color: 'from-green-500 to-green-600',
      teacher: teacher2._id,
      batch: bcomBatch._id
    });
    const bcomEcoUnit1 = await Unit.create({ name: 'Microeconomics', subject: bcomEco._id, order: 1 });
    const bcomEcoUnit2 = await Unit.create({ name: 'Macroeconomics', subject: bcomEco._id, order: 2 });
    const bcomEcoUnit3 = await Unit.create({ name: 'Market Structures', subject: bcomEco._id, order: 3 });
    bcomEco.units = [bcomEcoUnit1._id, bcomEcoUnit2._id, bcomEcoUnit3._id];
    await bcomEco.save();

    const bcomFM = await Subject.create({
      name: 'Financial Management',
      color: 'from-purple-500 to-purple-600',
      teacher: teacher2._id,
      batch: bcomBatch._id
    });
    const bcomFMUnit1 = await Unit.create({ name: 'Capital Budgeting', subject: bcomFM._id, order: 1 });
    const bcomFMUnit2 = await Unit.create({ name: 'Working Capital', subject: bcomFM._id, order: 2 });
    const bcomFMUnit3 = await Unit.create({ name: 'Dividend Policy', subject: bcomFM._id, order: 3 });
    bcomFM.units = [bcomFMUnit1._id, bcomFMUnit2._id, bcomFMUnit3._id];
    await bcomFM.save();

    const bcomMkt = await Subject.create({
      name: 'Marketing',
      color: 'from-orange-500 to-orange-600',
      teacher: teacher2._id,
      batch: bcomBatch._id
    });
    const bcomMktUnit1 = await Unit.create({ name: 'Marketing Mix', subject: bcomMkt._id, order: 1 });
    const bcomMktUnit2 = await Unit.create({ name: 'Consumer Behavior', subject: bcomMkt._id, order: 2 });
    const bcomMktUnit3 = await Unit.create({ name: 'Digital Marketing', subject: bcomMkt._id, order: 3 });
    bcomMkt.units = [bcomMktUnit1._id, bcomMktUnit2._id, bcomMktUnit3._id];
    await bcomMkt.save();

    const bcomLaw = await Subject.create({
      name: 'Business Law',
      color: 'from-pink-500 to-pink-600',
      teacher: teacher2._id,
      batch: bcomBatch._id
    });
    const bcomLawUnit1 = await Unit.create({ name: 'Contract Law', subject: bcomLaw._id, order: 1 });
    const bcomLawUnit2 = await Unit.create({ name: 'Company Law', subject: bcomLaw._id, order: 2 });
    const bcomLawUnit3 = await Unit.create({ name: 'Labor Law', subject: bcomLaw._id, order: 3 });
    bcomLaw.units = [bcomLawUnit1._id, bcomLawUnit2._id, bcomLawUnit3._id];
    await bcomLaw.save();

    const bcomStat = await Subject.create({
      name: 'Statistics',
      color: 'from-indigo-500 to-indigo-600',
      teacher: teacher2._id,
      batch: bcomBatch._id
    });
    const bcomStatUnit1 = await Unit.create({ name: 'Descriptive Statistics', subject: bcomStat._id, order: 1 });
    const bcomStatUnit2 = await Unit.create({ name: 'Probability', subject: bcomStat._id, order: 2 });
    const bcomStatUnit3 = await Unit.create({ name: 'Hypothesis Testing', subject: bcomStat._id, order: 3 });
    bcomStat.units = [bcomStatUnit1._id, bcomStatUnit2._id, bcomStatUnit3._id];
    await bcomStat.save();

    // Create CA Batch
    const caBatch = await Batch.create({
      name: 'CA',
      year: '2024',
      description: 'Chartered Accountancy',
      students: [],
      createdBy: admin._id
    });

    // CA Subjects and Units
    const caFA = await Subject.create({
      name: 'Financial Accounting',
      color: 'from-blue-500 to-blue-600',
      teacher: teacher2._id,
      batch: caBatch._id
    });
    const caFAUnit1 = await Unit.create({ name: 'Accounting Standards', subject: caFA._id, order: 1 });
    const caFAUnit2 = await Unit.create({ name: 'Financial Statements', subject: caFA._id, order: 2 });
    const caFAUnit3 = await Unit.create({ name: 'Consolidation', subject: caFA._id, order: 3 });
    caFA.units = [caFAUnit1._id, caFAUnit2._id, caFAUnit3._id];
    await caFA.save();

    const caCA = await Subject.create({
      name: 'Cost Accounting',
      color: 'from-green-500 to-green-600',
      teacher: teacher2._id,
      batch: caBatch._id
    });
    const caCAUnit1 = await Unit.create({ name: 'Cost Concepts', subject: caCA._id, order: 1 });
    const caCAUnit2 = await Unit.create({ name: 'Job Costing', subject: caCA._id, order: 2 });
    const caCAUnit3 = await Unit.create({ name: 'Process Costing', subject: caCA._id, order: 3 });
    caCA.units = [caCAUnit1._id, caCAUnit2._id, caCAUnit3._id];
    await caCA.save();

    const caAudit = await Subject.create({
      name: 'Auditing',
      color: 'from-purple-500 to-purple-600',
      teacher: teacher2._id,
      batch: caBatch._id
    });
    const caAuditUnit1 = await Unit.create({ name: 'Audit Planning', subject: caAudit._id, order: 1 });
    const caAuditUnit2 = await Unit.create({ name: 'Internal Control', subject: caAudit._id, order: 2 });
    const caAuditUnit3 = await Unit.create({ name: 'Audit Report', subject: caAudit._id, order: 3 });
    caAudit.units = [caAuditUnit1._id, caAuditUnit2._id, caAuditUnit3._id];
    await caAudit.save();

    const caTax = await Subject.create({
      name: 'Taxation',
      color: 'from-orange-500 to-orange-600',
      teacher: teacher2._id,
      batch: caBatch._id
    });
    const caTaxUnit1 = await Unit.create({ name: 'Income Tax', subject: caTax._id, order: 1 });
    const caTaxUnit2 = await Unit.create({ name: 'GST', subject: caTax._id, order: 2 });
    const caTaxUnit3 = await Unit.create({ name: 'Tax Planning', subject: caTax._id, order: 3 });
    caTax.units = [caTaxUnit1._id, caTaxUnit2._id, caTaxUnit3._id];
    await caTax.save();

    const caCorp = await Subject.create({
      name: 'Corporate Law',
      color: 'from-pink-500 to-pink-600',
      teacher: teacher2._id,
      batch: caBatch._id
    });
    const caCorpUnit1 = await Unit.create({ name: 'Company Formation', subject: caCorp._id, order: 1 });
    const caCorpUnit2 = await Unit.create({ name: 'Corporate Governance', subject: caCorp._id, order: 2 });
    const caCorpUnit3 = await Unit.create({ name: 'Mergers & Acquisitions', subject: caCorp._id, order: 3 });
    caCorp.units = [caCorpUnit1._id, caCorpUnit2._id, caCorpUnit3._id];
    await caCorp.save();

    const caEco = await Subject.create({
      name: 'Economics',
      color: 'from-indigo-500 to-indigo-600',
      teacher: teacher2._id,
      batch: caBatch._id
    });
    const caEcoUnit1 = await Unit.create({ name: 'Economic Environment', subject: caEco._id, order: 1 });
    const caEcoUnit2 = await Unit.create({ name: 'Fiscal Policy', subject: caEco._id, order: 2 });
    const caEcoUnit3 = await Unit.create({ name: 'Monetary Policy', subject: caEco._id, order: 3 });
    caEco.units = [caEcoUnit1._id, caEcoUnit2._id, caEcoUnit3._id];
    await caEco.save();

    // Update teachers with new subjects
    teacher1.subjects = [
      ...teacher1.subjects,
      bcaMath._id, bcaC._id, bcaDS._id, bcaDB._id, bcaWeb._id, bcaSE._id
    ];
    await teacher1.save();

    teacher2.subjects = [
      ...teacher2.subjects,
      bcomAcc._id, bcomEco._id, bcomFM._id, bcomMkt._id, bcomLaw._id, bcomStat._id,
      caFA._id, caCA._id, caAudit._id, caTax._id, caCorp._id, caEco._id
    ];
    await teacher2.save();

    console.log('Seed data created successfully!');
    console.log('\nLogin credentials:');
    console.log('Admin: admin@gfi.com / admin123');
    console.log('Verifier: verifier@gfi.com / verifier123');
    console.log('Teacher 1: teacher1@gfi.com / teacher123');
    console.log('Teacher 2: teacher2@gfi.com / teacher123');
    console.log('\nCreated batches:');
    console.log('- BCA 2024 (6 subjects, 18 units)');
    console.log('- BCOM 2024 (6 subjects, 18 units)');
    console.log('- CA 2024 (6 subjects, 18 units)');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
