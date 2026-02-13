import express from 'express';
import mongoose from 'mongoose';
import { protect, authorize } from '../middleware/auth.js';
import DailyTimeSlot from '../models/DailyTimeSlot.js';
import UnitLog from '../models/UnitLog.js';
import Unit from '../models/Unit.js';
import Subject from '../models/Subject.js';
import Approval from '../models/Approval.js';
import SubjectAssignment from '../models/SubjectAssignment.js';
import User from '../models/User.js';

const router = express.Router();

// All routes require authentication and teacher role
router.use(protect);
router.use(authorize('teacher', 'admin')); // Admin can also access these

// @route   GET /api/teacher/assignments
// @desc    Get subject assignments for current teacher (all statuses)
// @access  Private/Teacher
router.get('/assignments', async (req, res) => {
  try {
    const teacherId = req.user.id;
    
    // Get all assignments where this teacher is the recipient (toTeacher)
    // Filter out rejected assignments so they don't clutter the teacher's view
    const assignments = await SubjectAssignment.find({
      toTeacher: teacherId,
      status: { $ne: 'rejected' }
    })
      .populate({
        path: 'fromTeacher',
        select: 'name email',
        model: 'User',
        strictPopulate: false // Don't throw error if user doesn't exist
      })
      .populate({
        path: 'subject',
        select: 'name',
        model: 'Subject',
        strictPopulate: false // Don't throw error if subject doesn't exist
      })
      .populate({
        path: 'remainingUnits',
        select: 'name order',
        model: 'Unit',
        strictPopulate: false // Don't throw error if unit doesn't exist
      })
      .populate({
        path: 'requestedBy',
        select: 'name email',
        model: 'User',
        strictPopulate: false
      })
      .populate({
        path: 'approvedBy',
        select: 'name email',
        model: 'User',
        strictPopulate: false
      })
      .sort({ createdAt: -1 })
      .lean(); // Use lean() to get plain objects instead of Mongoose documents
    
    // Filter out any assignments with null populated fields and clean up the data
    const validAssignments = assignments
      .filter(assignment => {
        // Basic validation - assignment must exist and have required fields
        if (!assignment || !assignment._id) return false;
        // fromTeacher is optional (for new assignments), so we don't check for it here
        if (!assignment.subject || !assignment.subject._id) return false;
        if (!assignment.toTeacher) return false;
        return true;
      })
      .map(assignment => {
        // Clean up the assignment object to ensure all fields are safe
        return {
          _id: assignment._id,
          fromTeacher: assignment.fromTeacher ? {
            _id: assignment.fromTeacher._id,
            name: assignment.fromTeacher.name || 'Unknown Teacher',
            email: assignment.fromTeacher.email || 'N/A'
          } : null,
          toTeacher: {
            _id: teacherId.toString(),
            name: req.user.name || 'Current Teacher',
            email: req.user.email || 'N/A'
          },
          subject: assignment.subject ? {
            _id: assignment.subject._id,
            name: assignment.subject.name || 'Unknown Subject'
          } : null,
          remainingUnits: Array.isArray(assignment.remainingUnits) 
            ? assignment.remainingUnits
                .filter(unit => unit && unit._id)
                .map(unit => ({
                  _id: unit._id,
                  name: unit.name || 'Unknown Unit',
                  order: unit.order || 0
                }))
            : [],
          reason: assignment.reason || 'No reason provided',
          status: assignment.status || 'pending',
          requestedBy: assignment.requestedBy ? {
            _id: assignment.requestedBy._id,
            name: assignment.requestedBy.name || 'Unknown',
            email: assignment.requestedBy.email || 'N/A'
          } : null,
          approvedBy: assignment.approvedBy ? {
            _id: assignment.approvedBy._id,
            name: assignment.approvedBy.name || 'Unknown',
            email: assignment.approvedBy.email || 'N/A'
          } : null,
          rejectionReason: assignment.rejectionReason || null,
          createdAt: assignment.createdAt,
          approvedAt: assignment.approvedAt || null,
          rejectedAt: assignment.rejectedAt || null
        };
      });
    
    res.json({
      success: true,
      data: validAssignments
    });
  } catch (error) {
    console.error('Error loading assignments:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/teacher/assignments/:assignmentId/approve
// @desc    Teacher approves assignment (after admin approved); subject is transferred to teacher
// @access  Private/Teacher
router.post('/assignments/:assignmentId/approve', async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { assignmentId } = req.params;

    const assignment = await SubjectAssignment.findById(assignmentId)
      .populate('subject')
      .populate('fromTeacher')
      .populate('toTeacher');

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    const toTeacherRef = assignment.toTeacher && (assignment.toTeacher._id || assignment.toTeacher);
    const toTeacherId = toTeacherRef ? new mongoose.Types.ObjectId(String(toTeacherRef)) : null;
    const currentUserId = new mongoose.Types.ObjectId(String(teacherId));
    const isAdmin = req.user.role === 'admin';
    if (!toTeacherId || (!isAdmin && !toTeacherId.equals(currentUserId))) {
      return res.status(403).json({ success: false, message: 'Not authorized to approve this assignment' });
    }
    if (assignment.status === 'approved') {
      return res.json({
        success: true,
        message: 'Already accepted',
        data: assignment
      });
    }
    if (assignment.status !== 'admin_approved') {
      return res.status(400).json({
        success: false,
        message: `Assignment is ${assignment.status}; only admin-approved assignments can be accepted by teacher`
      });
    }

    assignment.status = 'approved';
    await assignment.save();

    const subject = await Subject.findById(assignment.subject._id);
    subject.teacher = assignment.toTeacher._id;
    await subject.save();

    // Add to New Teacher's subjects
    await User.findByIdAndUpdate(assignment.toTeacher._id, {
      $addToSet: { subjects: assignment.subject._id }
    });

    // Remove from Old Teacher's subjects (if applicable)
    if (assignment.fromTeacher) {
      await User.findByIdAndUpdate(assignment.fromTeacher._id, {
        $pull: { subjects: assignment.subject._id }
      });

      // Transfer active unit logs from old teacher to new teacher
      await UnitLog.updateMany(
        {
          teacher: assignment.fromTeacher._id,
          subject: assignment.subject._id,
          status: { $in: ['in-progress', 'not-started'] }
        },
        { teacher: assignment.toTeacher._id }
      );
    }

    const existingLogs = await UnitLog.find({
      teacher: assignment.toTeacher._id,
      subject: assignment.subject._id
    });
    const existingUnitIds = existingLogs.map(log => log.unit.toString());
    const remainingUnits = assignment.remainingUnits || [];
    const newLogs = remainingUnits
      .filter(unitId => !existingUnitIds.includes(unitId.toString()))
      .map(unitId => ({
        unit: unitId,
        teacher: assignment.toTeacher._id,
        subject: assignment.subject._id,
        startTime: new Date(),
        status: 'not-started'
      }));
    if (newLogs.length > 0) await UnitLog.insertMany(newLogs);

    await Approval.create({
      type: 'subject-assign',
      status: 'approved',
      requestedBy: assignment.requestedBy,
      approvedBy: teacherId,
      approvedAt: new Date(),
      requestData: {
        assignmentId: assignment._id,
        subjectName: assignment.subject?.name || 'Subject',
        toTeacherName: assignment.toTeacher?.name,
        approvedBy: 'teacher'
      }
    });

    res.json({
      success: true,
      message: 'Assignment accepted; subject is now assigned to you',
      data: assignment
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/teacher/assignments/:assignmentId/reject
// @desc    Teacher rejects assignment; verifier is notified
// @access  Private/Teacher
router.post('/assignments/:assignmentId/reject', async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { assignmentId } = req.params;
    const { reason } = req.body;

    const assignment = await SubjectAssignment.findById(assignmentId)
      .populate('subject')
      .populate('toTeacher');

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    const toTeacherRef = assignment.toTeacher && (assignment.toTeacher._id || assignment.toTeacher);
    const toTeacherId = toTeacherRef ? new mongoose.Types.ObjectId(String(toTeacherRef)) : null;
    const currentUserId = new mongoose.Types.ObjectId(String(teacherId));
    const isAdmin = req.user.role === 'admin';
    if (!toTeacherId || (!isAdmin && !toTeacherId.equals(currentUserId))) {
      return res.status(403).json({ success: false, message: 'Not authorized to reject this assignment' });
    }
    if (assignment.status !== 'admin_approved') {
      return res.status(400).json({
        success: false,
        message: `Assignment is ${assignment.status}; only admin-approved assignments can be rejected by teacher`
      });
    }

    assignment.status = 'rejected';
    assignment.rejectionReason = reason || 'Rejected by teacher';
    assignment.rejectedAt = new Date();
    await assignment.save();

    await Approval.create({
      type: 'subject-assign',
      status: 'rejected',
      requestedBy: assignment.requestedBy,
      approvedBy: teacherId,
      rejectionReason: reason || 'Rejected by teacher',
      rejectedAt: new Date(),
      requestData: {
        assignmentId: assignment._id,
        subjectName: assignment.subject?.name || 'Subject',
        toTeacherName: assignment.toTeacher?.name,
        rejectedBy: 'teacher'
      }
    });

    res.json({
      success: true,
      message: 'Assignment rejected; verifier has been notified',
      data: assignment
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/teacher/dashboard
// @desc    Get teacher dashboard data
// @access  Private/Teacher
router.get('/dashboard', async (req, res) => {
  try {
    const teacherId = req.user.role === 'teacher' ? req.user.id : req.query.teacherId || req.user.id;

    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Time slot definitions - must match the update route
    const slotDefinitions = {
      '9-10': { label: '9:00 - 10:00', duration: 60 },
      '10-11': { label: '10:00 - 11:00', duration: 60 },
      '11-12': { label: '11:00 - 12:00', duration: 60 },
      '12-13': { label: '12:00 - 13:00', duration: 60 },
      '13-14': { label: '13:00 - 14:00', duration: 60 },
      '14-15': { label: '14:00 - 15:00', duration: 60 },
      '15-16': { label: '15:00 - 16:00', duration: 60 },
      '16-17': { label: '16:00 - 17:00', duration: 60 }
    };

    // Get today's time slots
    let timeSlots = await DailyTimeSlot.findOne({
      teacher: teacherId,
      date: today
    });

    // If no time slots exist, create them
    if (!timeSlots) {
      timeSlots = await DailyTimeSlot.create({
        teacher: teacherId,
        date: today,
        slots: Object.entries(slotDefinitions).map(([id, def]) => ({
          slotId: id,
          label: def.label,
          duration: def.duration,
          checked: false,
          locked: false
        }))
      });
    } else {
      // Ensure all slots exist (for records created with old 5-slot format)
      const existingSlotIds = timeSlots.slots.map(s => s.slotId);
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
        timeSlots.slots.push(...missingSlots);
        await timeSlots.save();
      }
      
      // Also clear any locked flags on existing slots (migration for old data)
      let hasChanges = false;
      timeSlots.slots.forEach(s => {
        if (s.locked) {
          s.locked = false;
          hasChanges = true;
        }
      });
      if (hasChanges) {
        await timeSlots.save();
      }
    }

    // Get batch filter from query
    const batchId = req.query.batchId;
    
    // Build subject query
    // If batchId is provided, show all subjects in that batch (not just teacher's subjects)
    // Otherwise, show only subjects assigned to this teacher
    // Build subject query
    // Show only subjects assigned to this teacher, optionally filtered by batch
    const subjectQuery = { teacher: teacherId };
    if (batchId && batchId !== 'all') {
      subjectQuery.batch = batchId;
    }

    // Get all subjects (filtered by batch if provided, or by teacher if not)
    const subjects = await Subject.find(subjectQuery).populate('units').populate('batch', 'name year').populate('teacher', 'name email');

    // Get all unit logs for teacher
    const unitLogs = await UnitLog.find({ teacher: teacherId })
      .populate('unit')
      .populate('subject')
      .sort({ createdAt: -1 });

    // Format subjects with unit statuses
    const formattedSubjects = await Promise.all(subjects.map(async (subject) => {
      const subjectUnits = subject.units || [];
      const units = await Promise.all(subjectUnits.map(async (unit) => {
        // unit is already populated, so it's a full Unit document
        const log = unitLogs.find(
          log => log.unit._id.toString() === unit._id.toString() &&
          log.subject._id.toString() === subject._id.toString()
        );

        let status = 'not-started';
        let elapsedTime = 0;
        let startedAt, completedAt;
        let progressDays = 0;

        if (log) {
          status = log.status;
          if (status === 'in-progress') {
            elapsedTime = Math.floor((new Date() - log.startTime) / 1000); // seconds
            // Calculate days since start (progress shows from day 2)
            const daysSinceStart = Math.floor((new Date() - log.startTime) / (1000 * 60 * 60 * 24));
            progressDays = daysSinceStart >= 1 ? daysSinceStart : 0; // Show from day 2 (index 1 = day 2)
          } else if (status === 'completed' && log.totalMinutes) {
            elapsedTime = log.totalMinutes * 60; // convert to seconds
          }
          startedAt = log.startTime;
          completedAt = log.endTime;
        }

        return {
          id: unit._id.toString(),
          name: unit.name,
          status,
          startedAt,
          completedAt,
          elapsedTime,
          progressDays
        };
      }));

      return {
        id: subject._id.toString(),
        name: subject.name,
        color: subject.color,
        batch: subject.batch ? {
          id: subject.batch._id,
          name: subject.batch.name,
          year: subject.batch.year
        } : null,
        units
      };
    }));

    res.json({
      success: true,
      data: {
        timeSlots: timeSlots || {
          date: today,
          slots: [],
          totalHours: 0
        },
        subjects: formattedSubjects,
        currentUser: {
          id: req.user.id,
          name: req.user.name,
          role: req.user.role
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/teacher/time-slots/approval-status
// @desc    Get approval status for time slots and break timing for today
// @access  Private/Teacher
router.get('/time-slots/approval-status', async (req, res) => {
  try {
    const teacherId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all approvals for today's time slots
    const slotApprovals = await Approval.find({
      type: 'time-slot',
      requestedBy: teacherId,
      'requestData.date': today.toISOString()
    })
      .sort({ createdAt: -1 });

    // Get all approvals for today's break timing
    const breakApprovals = await Approval.find({
      type: 'break-timing',
      requestedBy: teacherId,
      'requestData.date': today.toISOString()
    })
      .sort({ createdAt: -1 });

    // Create a map of slotId -> latest approval status
    const statusMap = {};
    slotApprovals.forEach(approval => {
      const slotId = approval.requestData.slotId;
      // Only set if not already set (to get the latest status)
      if (!statusMap[slotId] || new Date(approval.createdAt) > new Date(statusMap[slotId].createdAt)) {
        statusMap[slotId] = {
          status: approval.status,
          approvalId: approval._id,
          createdAt: approval.createdAt,
          approvedAt: approval.approvedAt,
          rejectedAt: approval.rejectedAt,
          rejectionReason: approval.rejectionReason,
          requestData: approval.requestData // Include full request data
        };
      }
    });

    // Add break timing approval status
    if (breakApprovals.length > 0) {
      // Get the latest break approval
      const latestBreakApproval = breakApprovals[0];
      statusMap['break-timing'] = {
        status: latestBreakApproval.status,
        approvalId: latestBreakApproval._id,
        createdAt: latestBreakApproval.createdAt,
        approvedAt: latestBreakApproval.approvedAt,
        rejectedAt: latestBreakApproval.rejectedAt,
        rejectionReason: latestBreakApproval.rejectionReason,
        requestData: latestBreakApproval.requestData // Include break duration value
      };
    }

    res.json({
      success: true,
      data: statusMap
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/teacher/time-slots/break
// @desc    Request break timing update (requires approval)
// @access  Private/Teacher
router.post('/time-slots/break', async (req, res) => {
  try {
    const teacherId = req.user.role === 'teacher' ? req.user.id : req.body.teacherId || req.user.id;
    let { breakDuration } = req.body;

    console.log('📥 Break timing request received:', { breakDuration, teacherId, body: req.body });

    // Convert breakDuration to number if it's a string
    if (breakDuration !== null && breakDuration !== undefined && breakDuration !== '') {
      breakDuration = parseInt(breakDuration, 10);
      if (isNaN(breakDuration)) {
        breakDuration = null;
      }
    } else {
      breakDuration = null;
    }

    console.log('📊 Processed breakDuration:', breakDuration);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Ensure DailyTimeSlot record exists
    let currentTimeSlot = await DailyTimeSlot.findOne({
      teacher: teacherId,
      date: today
    });

    if (!currentTimeSlot) {
      const slotDefinitions = {
        '9-10': { label: '9:00 - 10:00', duration: 60 },
        '10-11': { label: '10:00 - 11:00', duration: 60 },
        '11-12': { label: '11:00 - 12:00', duration: 60 },
        '12-13': { label: '12:00 - 13:00', duration: 60 },
        '13-14': { label: '13:00 - 14:00', duration: 60 },
        '14-15': { label: '14:00 - 15:00', duration: 60 },
        '15-16': { label: '15:00 - 16:00', duration: 60 },
        '16-17': { label: '16:00 - 17:00', duration: 60 }
      };

      currentTimeSlot = await DailyTimeSlot.create({
        teacher: teacherId,
        date: today,
        slots: Object.entries(slotDefinitions).map(([id, def]) => ({
          slotId: id,
          label: def.label,
          duration: def.duration,
          checked: false,
          locked: false
        }))
      });
    }

    // If breakDuration is null or 0, it means removing break (immediate)
    if (!breakDuration || breakDuration === 0) {
      currentTimeSlot.breakDuration = null;
      currentTimeSlot.breakChecked = false;
      currentTimeSlot.breakCheckedAt = null;
      
      // Recalculate total hours
      const checkedSlots = currentTimeSlot.slots.filter(s => s.checked);
      currentTimeSlot.totalHours = (checkedSlots.length * 60) / 60;
      
      await currentTimeSlot.save();
      
      // Cancel any pending approval requests for break timing
      await Approval.updateMany(
        {
          type: 'break-timing',
          status: 'pending',
          requestedBy: teacherId,
          'requestData.date': today.toISOString()
        },
        {
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: teacherId,
          rejectionReason: 'Break timing removed by teacher - no approval needed'
        }
      );
      
      return res.json({
        success: true,
        message: 'Break timing removed successfully',
        data: {
          breakDuration: null,
          immediate: true
        }
      });
    }

    // Check if break duration is already set to this value
    if (currentTimeSlot.breakDuration === breakDuration && currentTimeSlot.breakChecked) {
      return res.status(400).json({
        success: false,
        message: 'This break duration is already set. No action needed.'
      });
    }

    // Setting break duration requires approval
    // Check if there's already a pending approval for this break duration
    const existingPendingApproval = await Approval.findOne({
      type: 'break-timing',
      status: 'pending',
      requestedBy: teacherId,
      'requestData.date': today.toISOString(),
      'requestData.breakDuration': breakDuration
    });

    if (existingPendingApproval) {
      return res.json({
        success: true,
        message: 'Break timing request already pending approval',
        data: {
          approvalId: existingPendingApproval._id,
          status: 'pending'
        }
      });
    }

    // Create new approval request for break timing
    const approval = await Approval.create({
      type: 'break-timing',
      status: 'pending',
      requestedBy: teacherId,
      requestData: {
        teacherId: teacherId,
        date: today.toISOString(),
        breakDuration: breakDuration
      }
    });

    res.json({
      success: true,
      message: 'Break timing request submitted (pending verifier approval)',
      data: {
        approvalId: approval._id,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('❌ Error in break timing route:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   POST /api/teacher/time-slots
// @desc    Request time slot update (selections require approval, deselections are immediate)
// @access  Private/Teacher
router.post('/time-slots', async (req, res) => {
  try {
    const teacherId = req.user.role === 'teacher' ? req.user.id : req.body.teacherId || req.user.id;
    const { slotId, checked, breakDuration } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check the CURRENT state of the slot in the database
    let currentTimeSlot = await DailyTimeSlot.findOne({
      teacher: teacherId,
      date: today
    });

    // Ensure DailyTimeSlot record exists
    if (!currentTimeSlot) {
      const slotDefinitions = {
        '9-10': { label: '9:00 - 10:00', duration: 60 },
        '10-11': { label: '10:00 - 11:00', duration: 60 },
        '11-12': { label: '11:00 - 12:00', duration: 60 },
        '12-13': { label: '12:00 - 13:00', duration: 60 },
        '13-14': { label: '13:00 - 14:00', duration: 60 },
        '14-15': { label: '14:00 - 15:00', duration: 60 },
        '15-16': { label: '15:00 - 16:00', duration: 60 },
        '16-17': { label: '16:00 - 17:00', duration: 60 }
      };

      currentTimeSlot = await DailyTimeSlot.create({
        teacher: teacherId,
        date: today,
        slots: Object.entries(slotDefinitions).map(([id, def]) => ({
          slotId: id,
          label: def.label,
          duration: def.duration,
          checked: false,
          locked: false
        }))
      });
    }

    const currentSlot = currentTimeSlot.slots.find(s => s.slotId === slotId);
    
    // If trying to select a slot that's already checked, or deselect one that's not checked
    // This means the action matches the current state - no need to send request
    if (currentSlot) {
      if (checked && currentSlot.checked) {
        return res.status(400).json({
          success: false,
          message: `This time slot is already selected. No action needed.`
        });
      }
      if (!checked && !currentSlot.checked) {
        return res.status(400).json({
          success: false,
          message: `This time slot is already deselected. No action needed.`
        });
      }
    }

    // CRITICAL: DESELECTIONS are IMMEDIATE (no approval needed)
    // SELECTIONS require verifier approval
    if (!checked) {
      // DESELECTION - Apply immediately
      if (!currentSlot) {
        // Slot doesn't exist in DB - can't deselect what was never selected
        // But ensure slot exists in the array first
        const slotDefinitions = {
          '9-10': { label: '9:00 - 10:00', duration: 60 },
          '10-11': { label: '10:00 - 11:00', duration: 60 },
          '11-12': { label: '11:00 - 12:00', duration: 60 },
          '12-13': { label: '12:00 - 13:00', duration: 60 },
          '13-14': { label: '13:00 - 14:00', duration: 60 },
          '14-15': { label: '14:00 - 15:00', duration: 60 },
          '15-16': { label: '15:00 - 16:00', duration: 60 },
          '16-17': { label: '16:00 - 17:00', duration: 60 }
        };
        
        const slotDef = slotDefinitions[slotId];
        if (slotDef) {
          currentTimeSlot.slots.push({
            slotId: slotId,
            label: slotDef.label,
            duration: slotDef.duration,
            checked: false, // Already deselected
            locked: false
          });
          currentSlot = currentTimeSlot.slots[currentTimeSlot.slots.length - 1];
        } else {
          return res.status(400).json({
            success: false,
            message: `Invalid time slot ID: ${slotId}`
          });
        }
      }
      
      // Apply deselection immediately
      currentSlot.checked = false;
      currentSlot.checkedAt = null;
      
      // Recalculate total hours
      const checkedSlots = currentTimeSlot.slots.filter(s => s.checked);
      const breakDurationValue = currentTimeSlot.breakDuration || 0;
      currentTimeSlot.totalHours = (checkedSlots.length * 60 - breakDurationValue) / 60;
      
      await currentTimeSlot.save();
      
      // Cancel any pending approval requests for this slot
      await Approval.updateMany(
        {
          type: 'time-slot',
          status: 'pending',
          requestedBy: teacherId,
          'requestData.slotId': slotId,
          'requestData.date': today.toISOString()
        },
        {
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: teacherId, // Self-rejection for deselection
          rejectionReason: 'Slot deselected by teacher - no approval needed'
        }
      );
      
      console.log(`✅ Slot ${slotId} deselected immediately - checked: false in DB`);
      
      return res.json({
        success: true,
        message: 'Time slot deselected successfully',
        data: {
          slotId: slotId,
          checked: false,
          immediate: true
        }
      });
    }

    // SELECTION - Requires verifier approval
    // Check if there's already a pending approval for this exact slot+date+checked combination
    const existingPendingApproval = await Approval.findOne({
      type: 'time-slot',
      status: 'pending',
      requestedBy: teacherId,
      'requestData.slotId': slotId,
      'requestData.date': today.toISOString(),
      'requestData.checked': true
    });

    if (existingPendingApproval) {
      // Already have this exact request pending, don't create duplicate
      return res.json({
        success: true,
        message: 'Time slot selection request already pending approval',
        data: {
          approvalId: existingPendingApproval._id,
          status: 'pending'
        }
      });
    }

    // Check if there's already a PENDING request for deselection - cancel it first
    const conflictingApproval = await Approval.findOne({
      type: 'time-slot',
      status: 'pending',
      requestedBy: teacherId,
      'requestData.slotId': slotId,
      'requestData.date': today.toISOString(),
      'requestData.checked': false
    });

    if (conflictingApproval) {
      // Update the conflicting approval instead of creating a new one
      conflictingApproval.requestData.checked = true;
      await conflictingApproval.save();
      
      return res.json({
        success: true,
        message: 'Time slot selection request updated (pending verifier approval)',
        data: {
          approvalId: conflictingApproval._id,
          status: 'pending'
        }
      });
    }

    // Create new approval request for selection
    const approval = await Approval.create({
      type: 'time-slot',
      status: 'pending',
      requestedBy: teacherId,
      requestData: {
        teacherId: teacherId,
        date: today.toISOString(),
        slotId: slotId,
        checked: true
      }
    });

    res.json({
      success: true,
      message: 'Time slot selection request submitted (pending verifier approval)',
      data: {
        approvalId: approval._id,
        status: 'pending'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/teacher/units/:unitId/start
// @desc    Start a unit
// @access  Private/Teacher
router.post('/units/:unitId/start', async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { unitId } = req.params;

    // Get unit first to get the subject
    const unit = await Unit.findById(unitId);
    if (!unit) {
      return res.status(404).json({
        success: false,
        message: 'Unit not found'
      });
    }

    // Get subject and populate teacher if needed
    const subject = await Subject.findById(unit.subject);
    if (!subject) {
      console.error(`Subject not found for unit ${unitId}, unit.subject:`, unit.subject);
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    // Check if another unit in the SAME subject is in progress
    const inProgressUnitInSameSubject = await UnitLog.findOne({
      teacher: teacherId,
      status: 'in-progress',
      subject: subject._id
    });

    if (inProgressUnitInSameSubject) {
      // Get the in-progress unit details for better error message
      const inProgressUnit = await Unit.findById(inProgressUnitInSameSubject.unit);
      const unitName = inProgressUnit ? inProgressUnit.name : 'another unit';
      return res.status(400).json({
        success: false,
        message: `Another unit (${unitName}) in ${subject.name} is already in progress. Please complete it first before starting a new one.`
      });
    }

    // Verify teacher owns this subject (admins can start any unit)
    if (req.user.role !== 'admin') {
      // Double-check: Query database to verify this subject belongs to the current teacher
      // This handles any potential data inconsistencies or type mismatches
      const teacherSubject = await Subject.findOne({ 
        _id: subject._id,
        teacher: teacherId 
      });
      
      if (!teacherSubject) {
        console.error(`❌ Authorization failed:`);
        console.error(`  - Unit ID: ${unitId}`);
        console.error(`  - Subject ID: ${subject._id}`);
        console.error(`  - Subject name: ${subject.name}`);
        console.error(`  - Subject teacher: ${subject.teacher}`);
        console.error(`  - Current teacher ID: ${teacherId}`);
        return res.status(403).json({
          success: false,
          message: 'Not authorized to start this unit. This unit belongs to a different teacher\'s subject.'
        });
      }
      console.log(`✅ Authorization passed: Teacher ${teacherId} owns subject ${subject._id} (${subject.name})`);
    }

    // Check if unit log already exists
    const existingLog = await UnitLog.findOne({
      unit: unitId,
      teacher: teacherId
    });

    if (existingLog) {
      if (existingLog.status === 'in-progress') {
        return res.status(400).json({
          success: false,
          message: 'This unit is already in progress'
        });
      }
      // If log exists but is completed, update it to in-progress
      existingLog.status = 'in-progress';
      existingLog.startTime = new Date();
      existingLog.endTime = null;
      existingLog.totalMinutes = 0;
      await existingLog.save();
      
      return res.json({
        success: true,
        message: 'Unit started successfully',
        data: {
          unitLogId: existingLog._id,
          status: 'in-progress'
        }
      });
    }

    // Create unit log directly (no approval needed)
    const unitLog = await UnitLog.create({
      unit: unitId,
      teacher: teacherId,
      subject: subject._id,
      startTime: new Date(),
      status: 'in-progress'
    });

    res.json({
      success: true,
      message: 'Unit started successfully',
      data: {
        unitLogId: unitLog._id,
        status: 'in-progress'
      }
    });
  } catch (error) {
    console.error('Error starting unit:', error);
    console.error('Error code:', error.code);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Handle specific MongoDB duplicate key errors
    if (error.code === 11000 || error.name === 'MongoServerError' || (error.message && error.message.includes('duplicate key'))) {
      const errorMessage = error.message || '';
      if (errorMessage.includes('unitId') || errorMessage.includes('teacherId')) {
        return res.status(500).json({
          success: false,
          message: 'Database index error detected. Please run the fix script: cd backend && node scripts/fix-unitlog-index.js. Then restart the backend.'
        });
      }
      // Generic duplicate key error - might be a race condition, try to find existing log
      return res.status(409).json({
        success: false,
        message: 'A unit log already exists for this unit. Please refresh the page and try again.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start unit. Please try again.'
    });
  }
});

// @route   POST /api/teacher/units/:unitId/complete
// @desc    Request unit completion (requires verifier approval)
// @access  Private/Teacher
router.post('/units/:unitId/complete', async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { unitId } = req.params;

    // Find unit log
    const unitLog = await UnitLog.findOne({
      unit: unitId,
      teacher: teacherId
    }).populate('unit');

    if (!unitLog) {
      return res.status(404).json({
        success: false,
        message: 'Unit log not found. Please start the unit first.'
      });
    }

    if (unitLog.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Unit is already completed'
      });
    }

    if (unitLog.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        message: 'Unit must be in progress to complete'
      });
    }

    // Complete the unit directly (no approval needed)
    unitLog.endTime = new Date();
    unitLog.status = 'completed';
    await unitLog.save();

    res.json({
      success: true,
      message: 'Unit completed successfully',
      data: {
        unitLogId: unitLog._id,
        status: 'completed'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/teacher/pending-approvals
// @desc    Get pending approvals for current teacher
// @access  Private/Teacher
router.get('/pending-approvals', async (req, res) => {
  try {
    const teacherId = req.user.id;

    const pendingApprovals = await Approval.find({
      requestedBy: teacherId,
      status: 'pending'
    })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: pendingApprovals
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/teacher/notifications
// @desc    Get all notifications (pending, approved, rejected) for current teacher
// @access  Private/Teacher
router.get('/notifications', async (req, res) => {
  try {
    const teacherId = req.user.id;

    const notifications = await Approval.find({
      requestedBy: teacherId
    })
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/teacher/approvals/:approvalId/cancel
// @desc    Cancel a pending approval request (teacher can cancel their own requests)
// @access  Private/Teacher
router.post('/approvals/:approvalId/cancel', async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { approvalId } = req.params;

    const approval = await Approval.findById(approvalId);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approval request not found'
      });
    }

    // Verify teacher owns this request
    if (approval.requestedBy.toString() !== teacherId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this request'
      });
    }

    // Only allow canceling pending requests
    if (approval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel request with status: ${approval.status}. Only pending requests can be canceled.`
      });
    }

    // Delete the approval request
    await Approval.findByIdAndDelete(approvalId);

    res.json({
      success: true,
      message: 'Approval request canceled successfully',
      data: { approvalId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/teacher/calendar
// @desc    Get calendar data (time slots and unit logs) for a date range
// @access  Private/Teacher
router.get('/calendar', async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include the entire end date

    // Get time slots for the date range
    const timeSlots = await DailyTimeSlot.find({
      teacher: teacherId,
      date: { $gte: start, $lte: end }
    })
      .populate({
        path: 'teacher',
        select: 'name email',
        strictPopulate: false
      })
      .sort({ date: 1 })
      .lean();

    // Get approval status for time slots
    const approvalStatusMap = new Map();
    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];
    
    const approvals = await Approval.find({
      type: 'time-slot',
      requestedBy: teacherId,
      createdAt: { $gte: start, $lte: end }
    })
      .sort({ createdAt: -1 })
      .lean();

    // Create a map of slotId + date -> latest approval status
    // Filter by date range and get the most recent approval for each slot
    approvals.forEach(approval => {
      const slotId = approval.requestData?.slotId;
      const date = approval.requestData?.date;
      if (slotId && date) {
        // Check if this approval is within the date range
        const approvalDate = new Date(date);
        if (approvalDate >= start && approvalDate <= end) {
          const key = `${date}-${slotId}`;
          if (!approvalStatusMap.has(key) || 
              new Date(approval.createdAt) > new Date(approvalStatusMap.get(key).createdAt)) {
            approvalStatusMap.set(key, {
              status: approval.status,
              checked: approval.requestData?.checked || false,
              createdAt: approval.createdAt
            });
          }
        }
      }
    });

    // Process time slots with approval status
    const processedTimeSlots = timeSlots.map(slot => {
      const dateStr = new Date(slot.date).toISOString().split('T')[0];
      const processedSlots = slot.slots.map(s => {
        const key = `${dateStr}-${s.slotId}`;
        const approval = approvalStatusMap.get(key);
        return {
          ...s,
          status: approval ? approval.status : (s.checked ? 'approved' : 'pending')
        };
      });
      return {
        ...slot,
        slots: processedSlots,
        scheduleEntries: Array.isArray(slot.scheduleEntries) ? slot.scheduleEntries : []
      };
    });

    // Get unit logs for the date range
    const unitLogs = await UnitLog.find({
      teacher: teacherId,
      startTime: { $gte: start, $lte: end }
    })
      .populate({
        path: 'subject',
        select: 'name color',
        strictPopulate: false
      })
      .populate({
        path: 'unit',
        select: 'name order',
        strictPopulate: false
      })
      .sort({ startTime: 1 })
      .lean();

    // Filter out logs with null populated fields
    const validLogs = unitLogs.filter(log => 
      log && log._id && 
      log.subject && log.subject._id && 
      log.unit && log.unit._id
    );

    res.json({
      success: true,
      data: {
        timeSlots: processedTimeSlots,
        unitLogs: validLogs.map(log => ({
          _id: log._id,
          subject: log.subject ? {
            _id: log.subject._id,
            name: log.subject.name || 'Unknown Subject',
            color: log.subject.color || '#6366f1'
          } : null,
          unit: log.unit ? {
            _id: log.unit._id,
            name: log.unit.name || 'Unknown Unit',
            order: log.unit.order || 0
          } : null,
          startTime: log.startTime,
          endTime: log.endTime,
          status: log.status,
          totalMinutes: log.totalMinutes || 0
        }))
      }
    });
  } catch (error) {
    console.error('Error loading calendar data:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PATCH /api/teacher/calendar/day
// @desc    Set subject and batch for an existing timetable day (for data that was applied before subject/batch was stored)
// @access  Private/Teacher
router.patch('/calendar/day', async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { date, subjectName, batch } = req.body || {};
    if (!date) {
      return res.status(400).json({ success: false, message: 'date is required' });
    }
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }
    targetDate.setHours(0, 0, 0, 0);

    const dailySlot = await DailyTimeSlot.findOne({
      teacher: teacherId,
      date: targetDate
    });
    if (!dailySlot) {
      return res.status(404).json({ success: false, message: 'No timetable found for this date' });
    }

    const slotIds = (dailySlot.scheduledSlotIds && dailySlot.scheduledSlotIds.length > 0)
      ? dailySlot.scheduledSlotIds
      : dailySlot.slots.map(s => s.slotId);
    dailySlot.scheduleEntries = [{
      subjectName: subjectName != null ? String(subjectName).trim() : '',
      batch: batch != null ? String(batch).trim() : '',
      slotIds
    }];
    await dailySlot.save();

    res.json({
      success: true,
      data: {
        date: dailySlot.date,
        scheduleEntries: dailySlot.scheduleEntries
      }
    });
  } catch (error) {
    console.error('Error updating calendar day:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
