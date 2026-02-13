import express from 'express';
import Batch from '../models/Batch.js';
import User from '../models/User.js';
import Subject from '../models/Subject.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/batch
// @desc    Get all batches (for admin, teacher, verifier)
// @access  Private
router.get('/', async (req, res) => {
  try {

    const batchesWithTeachers = await Batch.find()
      .populate('students', 'name email')
      .populate('teachers', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Fetch subjects for each batch
    const batchesWithSubjects = await Promise.all(batchesWithTeachers.map(async (batch) => {
      const subjects = await Subject.find({ batch: batch._id }).select('name').lean();
      return {
        ...batch,
        subjects: subjects.map(s => s.name)
      };
    }));

    const formattedBatches = batchesWithSubjects.map(batch => ({
      _id: batch._id,
      name: batch.name,
      year: batch.year,
      description: batch.description,
      studentCount: batch.students ? batch.students.length : 0,
      students: batch.students || [],
      teachers: batch.teachers || [],
      subjects: batch.subjects || [],
      createdBy: batch.createdBy,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt
    }));

    res.json({
      success: true,
      data: formattedBatches
    });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/batch/:id
// @desc    Get a single batch with teachers and students (for editing)
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id)
      .populate('students', 'name email')
      .populate('teachers', 'name email')
      .populate('createdBy', 'name email')
      .lean();

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    // Fetch subjects for this batch
    const subjects = await Subject.find({ batch: batch._id }).select('name').lean();

    res.json({
      success: true,
      data: {
        ...batch,
        studentCount: batch.students ? batch.students.length : 0,
        subjects: subjects.map(s => s.name)
      }
    });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/batch
// @desc    Create a new batch (admin, teacher, verifier)
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { name, year, description, studentIds, teacherIds } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Batch name is required'
      });
    }

    // Check if batch with same name already exists
    const existingBatch = await Batch.findOne({ name });
    if (existingBatch) {
      return res.status(400).json({
        success: false,
        message: 'Batch with this name already exists'
      });
    }

    const batch = await Batch.create({
      name,
      year: year || new Date().getFullYear().toString(),
      description: description || '',
      students: studentIds || [],
      teachers: teacherIds || [],
      createdBy: req.user.id
    });

    // Update users with batch assignment
    if (studentIds && studentIds.length > 0) {
      await User.updateMany(
        { _id: { $in: studentIds } },
        { $set: { batch: batch._id } }
      );
    }

    const populatedBatch = await Batch.findById(batch._id)
      .populate('students', 'name email')
      .populate('teachers', 'name email')
      .populate('createdBy', 'name email')
      .lean();

    res.status(201).json({
      success: true,
      data: {
        ...populatedBatch,
        studentCount: populatedBatch.students ? populatedBatch.students.length : 0
      }
    });
  } catch (error) {
    console.error('Error creating batch:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/batch/:id
// @desc    Update a batch
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const { name, year, description, studentIds, teacherIds } = req.body;

    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    // Check if name is being changed and if it conflicts
    if (name && name !== batch.name) {
      const existingBatch = await Batch.findOne({ name });
      if (existingBatch) {
        return res.status(400).json({
          success: false,
          message: 'Batch with this name already exists'
        });
      }
      batch.name = name;
    }

    if (year) batch.year = year;
    if (description !== undefined) batch.description = description;
    if (teacherIds !== undefined) batch.teachers = teacherIds;

    // Update students
    if (studentIds !== undefined) {
      // Remove batch from old students
      await User.updateMany(
        { batch: batch._id },
        { $unset: { batch: '' } }
      );

      // Add batch to new students
      batch.students = studentIds;
      if (studentIds.length > 0) {
        await User.updateMany(
          { _id: { $in: studentIds } },
          { $set: { batch: batch._id } }
        );
      }
    }

    await batch.save();

    const populatedBatch = await Batch.findById(batch._id)
      .populate('students', 'name email')
      .populate('teachers', 'name email')
      .populate('createdBy', 'name email')
      .lean();

    res.json({
      success: true,
      data: {
        ...populatedBatch,
        studentCount: populatedBatch.students ? populatedBatch.students.length : 0
      }
    });
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/batch/:id
// @desc    Delete a batch
// @access  Private (Admin, Verifier, Teacher)
router.delete('/:id', authorize('admin', 'verifier', 'teacher'), async (req, res) => {
  try {

    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    // Remove batch from all users
    await User.updateMany(
      { batch: batch._id },
      { $unset: { batch: '' } }
    );

    // Remove batch from all subjects
    await Subject.updateMany(
      { batch: batch._id },
      { $unset: { batch: '' } }
    );

    await Batch.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Batch deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting batch:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/batch/:id/students
// @desc    Get all students in a batch
// @access  Private
router.get('/:id/students', async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id)
      .populate('students', 'name email role')
      .lean();

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    res.json({
      success: true,
      data: batch.students || []
    });
  } catch (error) {
    console.error('Error fetching batch students:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
