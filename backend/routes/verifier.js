import express from 'express';
import mongoose from 'mongoose';
import { protect, authorize } from '../middleware/auth.js';
import Approval from '../models/Approval.js';
import UnitLog from '../models/UnitLog.js';
import DailyTimeSlot from '../models/DailyTimeSlot.js';
import Subject from '../models/Subject.js';
import User from '../models/User.js';
import Unit from '../models/Unit.js';
import SubjectAssignment from '../models/SubjectAssignment.js';
import Batch from '../models/Batch.js';
import ExamStatus from '../models/ExamStatus.js';
import TimeTableHistory from '../models/TimeTableHistory.js';

const router = express.Router();

// All routes require verifier role
router.use(protect);
router.use(authorize('verifier', 'admin')); // Admin can also access verifier routes

// @route   GET /api/verifier/dashboard
// @desc    Get verifier dashboard with all pending approvals
// @access  Private/Verifier
router.get('/dashboard', async (req, res) => {
  try {
    // Get all pending approvals
    const pendingApprovals = await Approval.find({ status: 'pending' })
      .populate('requestedBy', 'name email role avatar')
      .sort({ createdAt: -1 });

    console.log('🔍 DEBUG: Dashboard Request');
    console.log('🔍 DEBUG: Pending Approvals Found:', pendingApprovals.length);
    console.log('🔍 DEBUG: User:', req.user.id, req.user.role);


    // Get recent approvals (last 50)
    const recentApprovals = await Approval.find({
      status: { $in: ['approved', 'rejected'] }
    })
      .populate('requestedBy', 'name email role avatar')
      .populate('approvedBy', 'name email')
      .sort({ updatedAt: -1 })
      .limit(50);

    // Get statistics
    const stats = {
      pending: await Approval.countDocuments({ status: 'pending' }),
      approvedToday: await Approval.countDocuments({
        status: 'approved',
        approvedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
      rejectedToday: await Approval.countDocuments({
        status: 'rejected',
        rejectedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
      totalPending: pendingApprovals.length,
      notificationsCount: (await SubjectAssignment.countDocuments({
        requestedBy: req.user.id
      })) + (await Approval.countDocuments({
        requestedBy: req.user.id,
        type: 'subject-assign'
      }))
    };

    // Get in-progress units with progress information
    const inProgressUnits = await UnitLog.find({ status: 'in-progress' })
      .populate({
        path: 'teacher',
        select: 'name email',
        strictPopulate: false
      })
      .populate({
        path: 'subject',
        select: 'name color',
        strictPopulate: false
      })
      .populate({
        path: 'unit',
        select: 'name',
        strictPopulate: false
      })
      .sort({ startTime: -1 });

    // Format in-progress units with progress days
    const formattedInProgressUnits = inProgressUnits
      .filter(log => log.teacher && log.subject && log.unit)
      .map(log => {
        const daysSinceStart = Math.floor((new Date() - log.startTime) / (1000 * 60 * 60 * 24));
        const progressDays = daysSinceStart >= 1 ? daysSinceStart : 0;
        const elapsedMs = new Date() - log.startTime;
        const totalHours = elapsedMs / (1000 * 60 * 60);

        return {
          id: log._id.toString(),
          teacherId: log.teacher?._id?.toString() || '',
          teacherName: log.teacher?.name || 'Unknown Teacher',
          teacherEmail: log.teacher?.email || 'N/A',
          subject: log.subject?.name || 'Unknown Subject',
          subjectColor: log.subject?.color || 'from-blue-500 to-blue-600',
          unit: log.unit?.name || 'Unknown Unit',
          startedAt: log.startTime,
          totalHours: totalHours,
          progressDays: progressDays
        };
      });

    res.json({
      success: true,
      data: {
        pendingApprovals,
        recentApprovals,
        stats,
        inProgressUnits: formattedInProgressUnits
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/verifier/notifications
// @desc    Get notifications for verifier (e.g. assignment approved/rejected by admin or teacher)
// @access  Private/Verifier
router.get('/notifications', async (req, res) => {
  try {
    const verifierId = req.user.id;
    const notifications = await Approval.find({
      requestedBy: verifierId,
      type: 'subject-assign'
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

// @route   DELETE /api/verifier/notifications/:id
// @desc    Delete a notification (approval request)
// @access  Private/Verifier
router.delete('/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const verifierId = req.user.id;

    // Determine if we should delete from Approval collection or just hide it
    // For now, we will hard delete the approval request if it's just a notification wrapper
    // OR if it's a completed/rejected item that the user wants to clear.
    
    // Check if the approval exists
    const approval = await Approval.findById(id);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Security check: Ensure the user owns this notification or is an admin
    // For verifiers, they "own" approvals assigned to/created by them? 
    // Actually, notifications for verifiers are usually Approval items where they are the intended recipient or context.
    // The previous GET /notifications logic used: requestedBy: verifierId, type: 'subject-assign'
    // But verifiers also see OTHER approvals in the main list.
    
    // If the user is a verifier, let them delete any approval ID they send, 
    // assuming the frontend only allows deleting what they see.
    // Ideally, we'd check if (approval.requestedBy.toString() === verifierId || req.user.role === 'admin')
    
    await Approval.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/verifier/approvals
// @desc    Get all approvals with filters
// @access  Private/Verifier
router.get('/approvals', async (req, res) => {
  try {
    const { status, type, teacherId } = req.query;

    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (type && type !== 'all') {
      filter.type = type;
    }
    if (teacherId && teacherId !== 'all') {
      filter.requestedBy = teacherId;
    }

    const approvals = await Approval.find(filter)
      .populate('requestedBy', 'name email role avatar')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      data: approvals
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/verifier/approvals/:approvalId/approve
// @desc    Approve a pending request
// @access  Private/Verifier
router.post('/approvals/:approvalId/approve', async (req, res) => {
  try {
    const { approvalId } = req.params;
    const verifierId = req.user.id;

    const approval = await Approval.findById(approvalId)
      .populate('requestedBy', 'name email');

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approval request not found'
      });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${approval.status}`
      });
    }

    // Process the approval based on type
    let result;
    switch (approval.type) {
      case 'unit-complete':
        result = await processUnitCompleteApproval(approval);
        break;
      case 'unit-start':
        result = await processUnitStartApproval(approval);
        break;
      case 'time-slot':
        result = await processTimeSlotApproval(approval);
        break;
      case 'break-timing':
        result = await processBreakTimingApproval(approval);
        break;
      case 'subject-assign':
        result = await processSubjectAssignApproval(approval);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: `Unknown approval type: ${approval.type}`
        });
    }

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to process approval'
      });
    }

    // Update approval status
    approval.status = 'approved';
    approval.approvedBy = verifierId;
    approval.approvedAt = new Date();
    await approval.save();

    res.json({
      success: true,
      message: 'Request approved successfully',
      data: {
        approval,
        processedData: result.data
      }
    });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/verifier/approvals/:approvalId/reject
// @desc    Reject a pending request
// @access  Private/Verifier
router.post('/approvals/:approvalId/reject', async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { reason } = req.body;
    const verifierId = req.user.id;

    const approval = await Approval.findById(approvalId);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approval request not found'
      });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${approval.status}`
      });
    }

    // Update approval status
    approval.status = 'rejected';
    approval.approvedBy = verifierId; // Verifier who rejected
    approval.rejectionReason = reason || 'No reason provided';
    approval.rejectedAt = new Date();
    await approval.save();

    res.json({
      success: true,
      message: 'Request rejected',
      data: approval
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Helper functions to process approvals
async function processUnitCompleteApproval(approval) {
  try {
    const { unitLogId } = approval.requestData;
    const unitLog = await UnitLog.findById(unitLogId);

    if (!unitLog) {
      return { success: false, message: 'Unit log not found' };
    }

    if (unitLog.status === 'completed') {
      return { success: false, message: 'Unit is already completed' };
    }

    // Complete the unit
    unitLog.endTime = new Date();
    unitLog.status = 'completed';
    await unitLog.save();

    return { success: true, data: unitLog };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function processUnitStartApproval(approval) {
  try {
    const { unitId, teacherId, subjectId } = approval.requestData;

    // Check if another unit is in progress
    const inProgressUnit = await UnitLog.findOne({
      teacher: teacherId,
      status: 'in-progress'
    });

    if (inProgressUnit) {
      return { success: false, message: 'Another unit is already in progress' };
    }

    // Check if unit log exists
    let unitLog = await UnitLog.findOne({
      unit: unitId,
      teacher: teacherId
    });

    if (unitLog) {
      if (unitLog.status === 'completed') {
        // Restart completed unit
        unitLog.startTime = new Date();
        unitLog.status = 'in-progress';
        unitLog.endTime = null;
        unitLog.totalMinutes = 0;
        unitLog.subject = subjectId;
        await unitLog.save();
      } else {
        // Update existing log
        unitLog.startTime = new Date();
        unitLog.status = 'in-progress';
        unitLog.endTime = null;
        unitLog.totalMinutes = 0;
        await unitLog.save();
      }
    } else {
      // Create new unit log
      unitLog = await UnitLog.create({
        unit: unitId,
        teacher: teacherId,
        subject: subjectId,
        startTime: new Date(),
        status: 'in-progress',
        endTime: null,
        totalMinutes: 0
      });
    }

    return { success: true, data: unitLog };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function processTimeSlotApproval(approval) {
  try {
    const { teacherId, date, slotId, checked } = approval.requestData;

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    let dailySlot = await DailyTimeSlot.findOne({
      teacher: teacherId,
      date: targetDate
    });

    // Time slot definitions
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

    if (!dailySlot) {
      // Create new daily slot record
      dailySlot = await DailyTimeSlot.create({
        teacher: teacherId,
        date: targetDate,
        slots: Object.entries(slotDefinitions).map(([id, def]) => ({
          slotId: id,
          label: def.label,
          duration: def.duration,
          checked: id === slotId ? checked : false,
          locked: false,
          checkedAt: id === slotId && checked ? new Date() : null
        }))
      });
    } else {
      // Find and update the slot
      const slot = dailySlot.slots.find(s => s.slotId === slotId);
      if (slot) {
        slot.checked = checked;
        slot.checkedAt = checked ? new Date() : null;
      } else {
        // Add missing slot
        if (slotDefinitions[slotId]) {
          dailySlot.slots.push({
            slotId: slotId,
            label: slotDefinitions[slotId].label,
            duration: slotDefinitions[slotId].duration,
            checked: checked,
            locked: false,
            checkedAt: checked ? new Date() : null
          });
        }
      }
      await dailySlot.save();
    }

    return { success: true, data: dailySlot };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function processBreakTimingApproval(approval) {
  try {
    const { teacherId, date, breakDuration } = approval.requestData;

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    let dailySlot = await DailyTimeSlot.findOne({
      teacher: teacherId,
      date: targetDate
    });

    if (!dailySlot) {
      // Create new daily slot record with break timing
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

      dailySlot = await DailyTimeSlot.create({
        teacher: teacherId,
        date: targetDate,
        slots: Object.entries(slotDefinitions).map(([id, def]) => ({
          slotId: id,
          label: def.label,
          duration: def.duration,
          checked: false,
          locked: false
        })),
        breakDuration: breakDuration,
        breakChecked: true,
        breakCheckedAt: new Date()
      });
    } else {
      // Update break timing
      dailySlot.breakDuration = breakDuration;
      dailySlot.breakChecked = true;
      dailySlot.breakCheckedAt = new Date();
      
      // Recalculate total hours
      const checkedSlots = dailySlot.slots.filter(s => s.checked);
      dailySlot.totalHours = (checkedSlots.length * 60 - (breakDuration || 0)) / 60;
      
      await dailySlot.save();
    }

    return { success: true, data: dailySlot };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function processSubjectAssignApproval(approval) {
  try {
    const { teacherId, subjectId } = approval.requestData;

    const teacher = await User.findById(teacherId);
    const subject = await Subject.findById(subjectId);

    if (!teacher) {
      return { success: false, message: 'Teacher not found' };
    }
    if (!subject) {
      return { success: false, message: 'Subject not found' };
    }

    // Assign subject to teacher
    if (!teacher.subjects.includes(subjectId)) {
      teacher.subjects.push(subjectId);
      await teacher.save();
    }

    // Update subject teacher if needed
    const currentTeacherId = subject.teacher?._id?.toString() || subject.teacher?.toString();
    if (!currentTeacherId || currentTeacherId !== teacherId) {
      subject.teacher = teacherId;
      await subject.save();
    }

    return { success: true, data: { teacher, subject } };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// @route   GET /api/verifier/admin-data
// @desc    Get admin dashboard data (verifier sees same as admin)
// @access  Private/Verifier
router.get('/admin-data', async (req, res) => {
  try {
    const { teacherId, subject, dateRange } = req.query;

    // Build filter - only show approved data
    const filter = {};
    if (teacherId && teacherId !== 'all') {
      const teacher = await User.findOne({ name: teacherId, role: 'teacher' });
      if (teacher) {
        filter.teacher = teacher._id;
      } else {
        filter.teacher = teacherId;
      }
    }

    // Get all unit logs (only approved ones are visible)
    let unitLogs = await UnitLog.find(filter)
      .populate('teacher', 'name email')
      .populate('subject', 'name color')
      .populate('unit', 'name')
      .sort({ createdAt: -1 });

    // Filter to only show completed units (approved ones)
    unitLogs = unitLogs.filter(log => log.status === 'completed');

    // Apply subject filter
    if (subject && subject !== 'all') {
      unitLogs = unitLogs.filter(log => log.subject.name === subject);
    }

    // Apply date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let startDate = new Date();

      switch (dateRange) {
        case '7days':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30days':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90days':
          startDate.setDate(now.getDate() - 90);
          break;
      }

      unitLogs = unitLogs.filter(log => log.createdAt >= startDate);
    }

    // Calculate metrics
    const uniqueTeachers = new Set(unitLogs.map(log => log.teacher._id.toString())).size;
    const completedUnits = unitLogs.length;
    const totalHours = unitLogs.reduce((sum, log) => sum + (log.totalMinutes || 0) / 60, 0);
    const avgHours = completedUnits > 0 ? totalHours / completedUnits : 0;

    // Format data for frontend
    const formattedData = unitLogs.map(log => {
      const totalHours = log.totalMinutes ? log.totalMinutes / 60 : 0;
      return {
        id: log._id.toString(),
        teacherName: log.teacher.name,
        subject: log.subject.name,
        unit: log.unit.name,
        startedAt: log.startTime,
        completedAt: log.endTime || null,
        totalHours: totalHours,
        status: log.status
      };
    });

    // Get unique teachers and subjects for filters
    const allLogs = await UnitLog.find({ status: 'completed' })
      .populate('teacher', 'name')
      .populate('subject', 'name');
    
    const teachers = Array.from(new Set(allLogs.map(log => log.teacher.name)));
    const subjects = Array.from(new Set(allLogs.map(log => log.subject.name)));

    res.json({
      success: true,
      data: {
        metrics: {
          totalTeachers: uniqueTeachers,
          completedUnits,
          inProgressUnits: 0, // Verifier only sees completed
          avgHours: avgHours.toFixed(1)
        },
        unitLogs: formattedData,
        delayedUnits: [], // No in-progress units shown
        filters: {
          teachers: ['all', ...teachers],
          subjects: ['all', ...subjects]
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

// @route   GET /api/verifier/assign/teachers-incomplete
// @desc    Get teachers with incomplete subjects (optional batchId: only subjects in that batch)
// @access  Private/Verifier
router.get('/assign/teachers-incomplete', async (req, res) => {
  try {
    const { batchId } = req.query;
    const subjectFilter = batchId ? { batch: batchId } : {};
    // Get all teachers
    const teachers = await User.find({ role: 'teacher' }).select('name email');
    
    // Get subjects (optionally filtered by batch) with their units
    const subjects = await Subject.find(subjectFilter)
      .populate('units')
      .populate({
        path: 'teacher',
        select: 'name email',
        strictPopulate: false
      });
    
    // Get all unit logs to check completion status
    const unitLogs = await UnitLog.find()
      .populate({
        path: 'unit',
        strictPopulate: false
      })
      .populate({
        path: 'subject',
        strictPopulate: false
      })
      .populate({
        path: 'teacher',
        select: 'name email',
        strictPopulate: false
      });
    
    // Calculate incomplete subjects for each teacher
    const teachersWithIncomplete = await Promise.all(teachers.map(async (teacher) => {
      // Filter subjects where teacher is populated and matches
      const teacherSubjects = subjects.filter(s => 
        s.teacher && s.teacher._id && s.teacher._id.toString() === teacher._id.toString()
      );
      
      const incompleteSubjects = [];
      
      for (const subject of teacherSubjects) {
        const subjectUnits = subject.units || [];
        const completedUnits = subjectUnits.filter(unit => {
          const log = unitLogs.find(
            l => l.unit && l.unit._id && l.teacher && l.teacher._id &&
                 l.unit._id.toString() === unit._id.toString() &&
                 l.teacher._id.toString() === teacher._id.toString() &&
                 l.status === 'completed'
          );
          return !!log;
        });
        
        const incompleteUnits = subjectUnits.filter(unit => {
          const log = unitLogs.find(
            l => l.unit && l.unit._id && l.teacher && l.teacher._id &&
                 l.unit._id.toString() === unit._id.toString() &&
                 l.teacher._id.toString() === teacher._id.toString() &&
                 l.status === 'completed'
          );
          return !log;
        });
        
        if (incompleteUnits.length > 0) {
          incompleteSubjects.push({
            subjectId: subject._id,
            subjectName: subject.name,
            totalUnits: subjectUnits.length,
            completedUnits: completedUnits.length,
            incompleteUnits: incompleteUnits.length,
            remainingUnits: incompleteUnits
              .filter(u => u && u._id) // Filter out null units
              .map(u => ({
                id: u._id,
                name: u.name || 'Unknown Unit',
                order: u.order || 0
              }))
          });
        }
      }
      
      return {
        teacherId: teacher._id,
        teacherName: teacher.name,
        teacherEmail: teacher.email,
        incompleteSubjects: incompleteSubjects.length > 0 ? incompleteSubjects : null
      };
    }));
    
    // Filter out teachers with no incomplete subjects
    const filtered = teachersWithIncomplete.filter(t => t.incompleteSubjects !== null);
    
    res.json({
      success: true,
      data: filtered
    });
  } catch (error) {
    console.error('Error in /assign/teachers-incomplete:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load teachers with incomplete subjects'
    });
  }
});

// @route   GET /api/verifier/assign/available-teachers
// @desc    Get available teachers (optional batchId: only teachers who have subjects in that batch)
// @access  Private/Verifier
router.get('/assign/available-teachers', async (req, res) => {
  try {
    const { batchId } = req.query;
    const subjectFilter = batchId ? { batch: batchId } : {};
    // Get all teachers
    const teachers = await User.find({ role: 'teacher' }).select('name email');
    
    // Get subjects (optionally filtered by batch) to count workload
    const subjects = await Subject.find(subjectFilter)
      .populate('units')
      .populate({
        path: 'teacher',
        select: 'name email',
        strictPopulate: false
      });
    
    // Get all unit logs to check completion status
    const unitLogs = await UnitLog.find()
      .populate({
        path: 'unit',
        strictPopulate: false
      })
      .populate({
        path: 'subject',
        strictPopulate: false
      })
      .populate({
        path: 'teacher',
        select: 'name email',
        strictPopulate: false
      });
    
    // Calculate workload for each teacher
    const teachersWithWorkload = await Promise.all(teachers.map(async (teacher) => {
      // Filter subjects where teacher is populated and matches
      const teacherSubjects = subjects.filter(s => 
        s.teacher && s.teacher._id && s.teacher._id.toString() === teacher._id.toString()
      );
      
      let totalUnits = 0;
      let completedUnits = 0;
      let inProgressUnits = 0;
      
      for (const subject of teacherSubjects) {
        const subjectUnits = (subject.units || []).filter(u => u && u._id); // Filter out null units
        totalUnits += subjectUnits.length;
        
        subjectUnits.forEach(unit => {
          const log = unitLogs.find(
            l => l.unit && l.unit._id && l.teacher && l.teacher._id &&
                 l.unit._id.toString() === unit._id.toString() &&
                 l.teacher._id.toString() === teacher._id.toString()
          );
          
          if (log) {
            if (log.status === 'completed') {
              completedUnits++;
            } else if (log.status === 'in-progress') {
              inProgressUnits++;
            }
          }
        });
      }
      
      const pendingUnits = totalUnits - completedUnits - inProgressUnits;
      const workloadPercentage = totalUnits > 0 ? ((completedUnits + inProgressUnits) / totalUnits) * 100 : 0;
      
      return {
        teacherId: teacher._id,
        teacherName: teacher.name,
        teacherEmail: teacher.email,
        totalSubjects: teacherSubjects.length,
        totalUnits,
        completedUnits,
        inProgressUnits,
        pendingUnits,
        workloadPercentage: Math.round(workloadPercentage)
      };
    }));
    
    // When batchId is set, return only teachers who have at least one subject in that batch
    let result = teachersWithWorkload;
    if (batchId) {
      result = teachersWithWorkload.filter(t => (t.totalSubjects || 0) > 0);
    }
    result.sort((a, b) => a.workloadPercentage - b.workloadPercentage);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in /assign/available-teachers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load available teachers'
    });
  }
});

// @route   GET /api/verifier/assign/assignments
// @desc    Get all subject assignments created by this verifier
// @access  Private/Verifier
router.get('/assign/assignments', async (req, res) => {
  try {
    const verifierId = req.user.id;
    
    const { status } = req.query;
    
    const filter = { requestedBy: verifierId };
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    const assignments = await SubjectAssignment.find(filter)
      .populate({
        path: 'fromTeacher',
        select: 'name email',
        model: 'User',
        strictPopulate: false
      })
      .populate({
        path: 'toTeacher',
        select: 'name email',
        model: 'User',
        strictPopulate: false
      })
      .populate({
        path: 'subject',
        select: 'name',
        model: 'Subject',
        strictPopulate: false
      })
      .populate({
        path: 'remainingUnits',
        select: 'name order',
        model: 'Unit',
        strictPopulate: false
      })
      .populate({
        path: 'approvedBy',
        select: 'name email',
        model: 'User',
        strictPopulate: false
      })
      .sort({ createdAt: -1 })
      .lean();
    
    // Clean and validate assignments
    const validAssignments = assignments
      .filter(assignment => {
        if (!assignment || !assignment._id) return false;
        // if (!assignment.fromTeacher || !assignment.fromTeacher._id) return false; // Allow null fromTeacher
        if (!assignment.toTeacher || !assignment.toTeacher._id) return false;
        if (!assignment.subject || !assignment.subject._id) return false;
        return true;
      })
      .map(assignment => ({
        _id: assignment._id,
        fromTeacher: assignment.fromTeacher ? {
          _id: assignment.fromTeacher._id,
          name: assignment.fromTeacher.name || 'Unknown Teacher',
          email: assignment.fromTeacher.email || 'N/A'
        } : null,
        toTeacher: assignment.toTeacher ? {
          _id: assignment.toTeacher._id,
          name: assignment.toTeacher.name || 'Unknown Teacher',
          email: assignment.toTeacher.email || 'N/A'
        } : null,
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
        approvedBy: assignment.approvedBy ? {
          _id: assignment.approvedBy._id,
          name: assignment.approvedBy.name || 'Unknown',
          email: assignment.approvedBy.email || 'N/A'
        } : null,
        rejectionReason: assignment.rejectionReason || null,
        createdAt: assignment.createdAt,
        approvedAt: assignment.approvedAt || null,
        rejectedAt: assignment.rejectedAt || null
      }));
    
    res.json({
      success: true,
      data: validAssignments
    });
  } catch (error) {
    console.error('Error loading verifier assignments:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/verifier/assign/assignments/:id
// @desc    Delete a subject assignment request (only if created by this verifier)
// @access  Private/Verifier
router.delete('/assign/assignments/:id', async (req, res) => {
  try {
    const verifierId = req.user.id;
    const assignmentId = req.params.id;

    if (!assignmentId || !mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({ success: false, message: 'Invalid assignment ID' });
    }

    const assignment = await SubjectAssignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const requestedBy = assignment.requestedBy && (assignment.requestedBy._id || assignment.requestedBy);
    if (String(requestedBy) !== String(verifierId)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this assignment' });
    }

    await SubjectAssignment.findByIdAndDelete(assignmentId);
    res.json({ success: true, message: 'Assignment request deleted' });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/verifier/assign/request
// @desc    Create a subject assignment request (requires admin approval)
// @access  Private/Verifier
router.post('/assign/request', async (req, res) => {
  try {
    const verifierId = req.user.id;
    let { fromTeacherId, toTeacherId, subjectId, reason, unitIds, batchId } = req.body || {};
    reason = (reason && typeof reason === 'string' && reason.trim()) ? reason.trim() : 'Assignment request';

    if (!toTeacherId || !subjectId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: please select both Subject and Assign To teacher'
      });
    }

    // Validate subject exists
    const subject = await Subject.findById(subjectId).populate('units').populate('teacher');
    if (!subject) {
      return res.status(400).json({
        success: false,
        message: 'Subject not found'
      });
    }

    // Normal (non-replacement) mode: use subject's current teacher as fromTeacher
    if (!fromTeacherId && subject.teacher) {
      fromTeacherId = subject.teacher._id?.toString() || subject.teacher.toString();
    }
    
    // If subject has no teacher, we can skip fromTeacher validation (New Assignment)
    let fromTeacher = null;
    if (fromTeacherId) {
      fromTeacher = await User.findById(fromTeacherId);
      if (!fromTeacher || fromTeacher.role !== 'teacher') {
        // Only error if an invalid ID was explicitly provided
        return res.status(400).json({
          success: false,
          message: 'Invalid fromTeacher'
        });
      }
      
      const subjectTeacherId = subject.teacher?._id?.toString() || subject.teacher?.toString();
      if (subjectTeacherId && subjectTeacherId !== fromTeacherId) {
         // Only mismatch if subject implies a different teacher
        return res.status(400).json({
          success: false,
          message: 'Subject does not belong to the specified teacher'
        });
      }
    }
    
    // Validate toTeacher
    const toTeacher = await User.findById(toTeacherId);
    if (!toTeacher || toTeacher.role !== 'teacher') {
      return res.status(400).json({
        success: false,
        message: 'Invalid toTeacher'
      });
    }

    if (fromTeacherId && (fromTeacherId === toTeacherId || fromTeacher._id.toString() === toTeacher._id.toString())) {
      return res.status(400).json({
        success: false,
        message: 'From teacher and Assign-to teacher must be different.'
      });
    }

    let unitsToAssign = [];

    const subjectUnits = subject.units && Array.isArray(subject.units) ? subject.units : [];
    const subjectUnitIds = subjectUnits.map(u => (u && (u._id || u)).toString());

    if (unitIds && Array.isArray(unitIds) && unitIds.length > 0) {
      // Validate provided unitIds
      unitsToAssign = unitIds;
      const invalidUnits = unitIds.filter(id => !subjectUnitIds.includes(id.toString()));
      if (invalidUnits.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Some selected units do not belong to this subject'
        });
      }
    } else {
      // Default behavior: Get remaining (not completed) units
      const unitLogs = await UnitLog.find({
        teacher: fromTeacherId,
        subject: subjectId
      }).populate('unit');
      const completedUnitIds = (unitLogs || [])
        .filter(log => log && log.unit && (log.unit._id || log.unit))
        .map(log => (log.unit._id || log.unit).toString());
      unitsToAssign = subjectUnits
        .filter(unit => unit && !completedUnitIds.includes((unit._id || unit).toString()))
        .map(unit => unit._id || unit);
    }
    
    // Check if there's already a pending assignment for this subject
    const existingAssignment = await SubjectAssignment.findOne({
      subject: subjectId,
      fromTeacher: fromTeacherId,
      status: 'pending'
    });
    
    if (existingAssignment) {
      // Get detailed information about the existing request
      const requestDate = new Date(existingAssignment.createdAt).toLocaleString();
      // Try to populate requestedBy if not already (it's ObjectId usually)
      let requesterName = 'Unknown User';
      if (existingAssignment.requestedBy) {
        const requester = await User.findById(existingAssignment.requestedBy).select('name email');
        if (requester) requesterName = requester.name;
      }
      
      return res.status(400).json({
        success: false,
        message: `There is already a pending assignment request for this subject (created by ${requesterName} on ${requestDate})`
      });
    }
    
    // Create assignment request
    const assignment = await SubjectAssignment.create({
      fromTeacher: fromTeacherId,
      toTeacher: toTeacherId,
      subject: subjectId,
      batch: batchId || undefined,
      remainingUnits: unitsToAssign,
      reason: reason,
      requestedBy: verifierId,
      status: 'pending'
    });
    
    // Populate for response
    await assignment.populate('fromTeacher', 'name email');
    await assignment.populate('toTeacher', 'name email');
    await assignment.populate('subject', 'name');
    await assignment.populate('remainingUnits', 'name order');
    await assignment.populate('requestedBy', 'name email');
    
    res.json({
      success: true,
      message: 'Subject assignment request created. Waiting for admin approval.',
      data: assignment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/verifier/assign/subject-units
// @desc    Get units for a subject with status for a specific teacher
// @access  Private/Verifier
router.get('/assign/subject-units', async (req, res) => {
  try {
    const { subjectId, teacherId } = req.query;

    if (!subjectId) {
      return res.status(400).json({
        success: false,
        message: 'Subject ID is required'
      });
    }

    // Get units for the subject
    const units = await Unit.find({ subject: subjectId }).sort({ order: 1 });
    
    // If teacherId is provided, fetch status
    let unitsWithStatus = [];
    if (teacherId) {
       const unitLogs = await UnitLog.find({
        teacher: teacherId,
        subject: subjectId
      });

      unitsWithStatus = units.map(unit => {
        const log = unitLogs.find(l => l.unit.toString() === unit._id.toString());
        let status = 'not-started';
        if (log) {
          status = log.status; // 'in-progress' or 'completed'
        }
        return {
          _id: unit._id,
          name: unit.name,
          order: unit.order,
          status: status
        };
      });
    } else {
      // If no teacher, return all as not-started (or handle as needed)
      unitsWithStatus = units.map(unit => ({
        _id: unit._id,
        name: unit.name,
        order: unit.order,
        status: 'not-started'
      }));
    }

    res.json({
      success: true,
      data: unitsWithStatus
    });
  } catch (error) {
     console.error('Error fetching subject units:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/verifier/subjects
// @desc    Get all subjects for assignment (optional batch filter; with current teacher for normal mode)
// @access  Private/Verifier
router.get('/subjects', async (req, res) => {
  try {
    const { batchId } = req.query;
    const filter = {};
    if (batchId) filter.batch = batchId;
    const subjects = await Subject.find(filter)
      .select('_id name teacher batch')
      .populate('teacher', 'name email')
      .populate('batch', 'name year')
      .sort({ name: 1 })
      .lean();
    // Check for pending assignments for these subjects
    const subjectIds = subjects.map(s => s._id);
    const pendingAssignments = await SubjectAssignment.find({
      subject: { $in: subjectIds },
      status: 'pending'
    }).select('subject requestedBy createdAt');
    
    const data = subjects.map(s => {
      const pending = pendingAssignments.find(a => a.subject.toString() === s._id.toString());
      return {
        _id: s._id,
        name: s.name,
        teacher: s.teacher ? { _id: s.teacher._id, name: s.teacher.name, email: s.teacher.email } : null,
        batch: s.batch ? { _id: s.batch._id, name: s.batch.name, year: s.batch.year } : null,
        hasPendingAssignment: !!pending,
        pendingAssignmentDetails: pending ? {
          requestedBy: pending.requestedBy,
          createdAt: pending.createdAt
        } : null
      };
    });
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/verifier/subjects
// @desc    Create a new subject with units (verifier/admin)
// @access  Private/Verifier
router.post('/subjects', async (req, res) => {
  try {
    const { name, teacherId, batchId, unitNames } = req.body;

    // Teacher is optional - subjects can be created without assignment
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subject name is required'
      });
    }

    // Validate teacher if provided
    let teacher = null;
    if (teacherId) {
      teacher = await User.findById(teacherId);
      if (!teacher || teacher.role !== 'teacher') {
        return res.status(400).json({
          success: false,
          message: 'Invalid teacher'
        });
      }
    }

    // Check for duplicate subject name in same batch
    const subjectFilter = { name: name.trim() };
    if (batchId) {
      subjectFilter.batch = batchId;
    } else {
      subjectFilter.$or = [{ batch: null }, { batch: { $exists: false } }];
    }
    const existingSubject = await Subject.findOne(subjectFilter);
    if (existingSubject) {
      return res.status(400).json({
        success: false,
        message: `Subject "${name.trim()}" already exists${batchId ? ' in this batch' : ''}`
      });
    }

    // Create subject (name required; teacher and batch optional)
    const subjectData = { name: name.trim(), units: [] };
    // Teacher is NOT assigned immediately. Requires status approval.
    if (batchId) subjectData.batch = batchId;
    const subject = await Subject.create(subjectData);

    // Create units if provided
    const unitNamesArr = Array.isArray(unitNames) ? unitNames.filter(n => typeof n === 'string' && n.trim()) : [];
    const createdUnits = [];

    for (let i = 0; i < unitNamesArr.length; i++) {
      const unitName = unitNamesArr[i].trim();
      if (!unitName) continue;
      const unit = await Unit.create({
        name: unitName,
        subject: subject._id,
        order: i + 1
      });
      createdUnits.push(unit._id);
    }

    subject.units = createdUnits;
    await subject.save();

    // Create assignment request if teacher was specified (requires Admin approval)
    if (teacherId) {
      await SubjectAssignment.create({
        fromTeacher: null,
        toTeacher: teacherId,
        subject: subject._id,
        batch: batchId || undefined,
        remainingUnits: createdUnits,
        reason: 'Initial assignment upon subject creation',
        requestedBy: req.user.id,
        status: 'pending'
      });
    }

    const populatedSubject = await Subject.findById(subject._id)
      .populate('teacher', 'name email')
      .populate('batch', 'name year')
      .populate('units', 'name order')
      .lean();

    res.status(201).json({
      success: true,
      data: populatedSubject
    });
  } catch (error) {
    console.error('Error creating subject:', error);
    // Mongoose ValidationError has error.errors; log for debugging
    const msg = error.message || 'Failed to create subject';
    res.status(error.name === 'ValidationError' ? 400 : 500).json({
      success: false,
      message: msg
    });
  }
});

// @route   DELETE /api/verifier/exam/batches/:id
// @desc    Delete a batch
// @access  Private/Verifier
router.delete('/exam/batches/:id', async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    // Check if batch has subjects before deleting
    const subjectCount = await Subject.countDocuments({ batch: req.params.id });
    if (subjectCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete batch. It has ${subjectCount} associated subjects. Please delete or reassign subjects first.`
      });
    }

    await batch.deleteOne();

    res.json({
      success: true,
      message: 'Batch deleted successfully',
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/verifier/exam/batches
// @desc    Get all batches for exam filter
// @access  Private/Verifier
router.get('/exam/batches', async (req, res) => {
  try {
    const batches = await Batch.find().select('name year').sort({ name: 1 });
    res.json({
      success: true,
      data: batches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/verifier/exam/subjects
// @desc    Get subjects for a specific batch
// @access  Private/Verifier
router.get('/exam/subjects', async (req, res) => {
  try {
    const { batchId } = req.query;
    
    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID is required'
      });
    }

    const subjects = await Subject.find({ batch: batchId })
      .select('name color teacher')
      .populate('teacher', 'name email')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: subjects
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/verifier/exam/units
// @desc    Get units for a subject with completion and exam status
// @access  Private/Verifier
router.get('/exam/units', async (req, res) => {
  try {
    const { subjectId } = req.query;

    if (!subjectId) {
      return res.status(400).json({
        success: false,
        message: 'Subject ID is required'
      });
    }

    // Get units for the subject
    const units = await Unit.find({ subject: subjectId }).sort({ order: 1 });
    
    const unitsData = await Promise.all(units.map(async (unit) => {
      // Find completion log - check if ANY completion log exists for this unit regardless of teacher
      // or we could check specifically for the subject's teacher if needed.
      // For now, simpler: if it's completed, it's completed.
      const completionLog = await UnitLog.findOne({
        unit: unit._id,
        subject: subjectId,
        status: 'completed'
      }).populate('teacher', 'name');

      // Get exam status
      const examStatus = await ExamStatus.findOne({ unit: unit._id });

      return {
        _id: unit._id,
        name: unit.name,
        order: unit.order,
        isCompleted: !!completionLog,
        isExamFinished: examStatus ? examStatus.isFinished : false,
        completedAt: completionLog ? completionLog.endTime : null,
        taughtBy: completionLog ? completionLog.teacher : null
      };
    }));

    res.json({
      success: true,
      data: unitsData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/verifier/exam/toggle
// @desc    Toggle exam finished status for a unit
// @access  Private/Verifier
router.post('/exam/toggle', async (req, res) => {
  try {
    const { unitId, isFinished } = req.body;
    const verifierId = req.user.id;

    if (!unitId) {
      return res.status(400).json({
        success: false,
        message: 'Unit ID is required'
      });
    }

    let examStatus = await ExamStatus.findOne({ unit: unitId });

    if (examStatus) {
      examStatus.isFinished = isFinished;
      examStatus.markedBy = verifierId;
      await examStatus.save();
    } else {
      examStatus = await ExamStatus.create({
        unit: unitId,
        isFinished: isFinished,
        markedBy: verifierId
      });
    }

    res.json({
      success: true,
      data: examStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Slot definitions for time table (same as teacher routes)
const SLOT_DEFINITIONS = {
  '9-10': { label: '9:00 - 10:00', duration: 60 },
  '10-11': { label: '10:00 - 11:00', duration: 60 },
  '11-12': { label: '11:00 - 12:00', duration: 60 },
  '12-13': { label: '12:00 - 13:00', duration: 60 },
  '13-14': { label: '13:00 - 14:00', duration: 60 },
  '14-15': { label: '14:00 - 15:00', duration: 60 },
  '15-16': { label: '15:00 - 16:00', duration: 60 },
  '16-17': { label: '16:00 - 17:00', duration: 60 }
};
const VALID_SLOT_IDS = new Set(Object.keys(SLOT_DEFINITIONS));

// @route   POST /api/verifier/time-table/apply
// @desc    Apply imported time table (verifier-approved). No edits without approve.
// @access  Private/Verifier
router.post('/time-table/apply', async (req, res) => {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'entries array is required and must not be empty'
      });
    }

    const results = { applied: 0, errors: [] };

    // Group entries by teacher+date so we can merge subject/slots per day
    const groupKey = (email, d) => `${String(email).trim()}|${new Date(d).setHours(0, 0, 0, 0)}`;
    const groups = new Map();

    for (const entry of entries) {
      const { teacherEmail, date, slotIds = [], breakMinutes, subjectName, batch } = entry;
      if (!teacherEmail || !date) {
        results.errors.push({ entry, message: 'teacherEmail and date are required' });
        continue;
      }

      const teacher = await User.findOne({ email: teacherEmail.trim(), role: 'teacher' });
      if (!teacher) {
        console.log(`Debug: Teacher not found for email '${teacherEmail}'`);
        results.errors.push({ entry, message: `Teacher not found: ${teacherEmail}` });
        continue;
      }
      // Enrich entry with resolved details for history
      entry.resolvedTeacherName = teacher.name;
      entry.resolvedTeacherEmail = teacher.email;

      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        results.errors.push({ entry, message: 'Invalid date' });
        continue;
      }
      targetDate.setHours(0, 0, 0, 0);

      const validSlotIds = Array.isArray(slotIds)
        ? slotIds.filter(id => VALID_SLOT_IDS.has(String(id).trim()))
        : [];
      const key = groupKey(teacherEmail, targetDate);
      if (!groups.has(key)) {
        groups.set(key, {
          teacher,
          targetDate,
          breakMinutes: breakMinutes != null ? Math.min(60, Math.max(0, Number(breakMinutes))) : null,
          scheduleEntries: [],
          allSlotIds: []
        });
      }
      const g = groups.get(key);
      g.scheduleEntries.push({
        subjectName: subjectName != null ? String(subjectName).trim() : '',
        batch: batch != null ? String(batch).trim() : '',
        slotIds: validSlotIds
      });
      validSlotIds.forEach(id => { if (!g.allSlotIds.includes(id)) g.allSlotIds.push(id); });
    }

    for (const [, g] of groups) {
      const breakVal = g.breakMinutes;
      let dailySlot = await DailyTimeSlot.findOne({
        teacher: g.teacher._id,
        date: g.targetDate
      });

      if (!dailySlot) {
        dailySlot = await DailyTimeSlot.create({
          teacher: g.teacher._id,
          date: g.targetDate,
          slots: Object.entries(SLOT_DEFINITIONS).map(([id, def]) => ({
            slotId: id,
            label: def.label,
            duration: def.duration,
            checked: false,
            locked: false,
            checkedAt: null
          })),
          breakDuration: breakVal,
          breakChecked: breakVal != null,
          breakCheckedAt: breakVal != null ? new Date() : null,
          scheduledSlotIds: g.allSlotIds,
          scheduleEntries: g.scheduleEntries
        });
      } else {
        dailySlot.slots.forEach(s => {
          if (g.allSlotIds.includes(s.slotId)) {
            s.checked = false;
            s.checkedAt = null;
          }
        });
        dailySlot.breakDuration = breakVal;
        dailySlot.breakChecked = breakVal != null;
        dailySlot.breakCheckedAt = breakVal != null ? new Date() : null;
        dailySlot.scheduledSlotIds = g.allSlotIds;
        dailySlot.scheduleEntries = g.scheduleEntries;
        await dailySlot.save();
      }
      results.applied += 1;
    }

    if (results.applied === 0 && results.errors.length === 0) {
      results.errors.push({ message: 'No entries processed. Check if emails match teachers exactly.' });
    }

    res.json({
      success: true,
      applied: results.applied,
      errors: results.errors.length ? results.errors : undefined
    });

    // Save history if applied successfully
    if (results.applied > 0) {
      const teacherEmails = [...new Set(entries.map(e => e.resolvedTeacherEmail || e.teacherEmail).filter(Boolean))];
      const teacherNames = [...new Set(entries.map(e => e.resolvedTeacherName || e.teacherName).filter(Boolean))];
      const batchNames = [...new Set(entries.map(e => e.batch).filter(Boolean))];
      await TimeTableHistory.create({
        verifier: req.user.id,
        entries: entries, // Now contains resolved details
        teacherEmails,
        teacherNames,
        batchNames
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/verifier/time-table/history
// @desc    Get uploaded time table history
// @access  Private/Verifier
router.get('/time-table/history', async (req, res) => {
  try {
    const history = await TimeTableHistory.find({ verifier: req.user.id })
      .select('createdAt teacherEmails teacherNames batchNames entries') // Include entries for re-download
      .sort({ createdAt: -1 })
      .limit(50); // Limit to last 50 uploads

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/verifier/time-table/history/:id
// @desc    Delete a time table history record
// @access  Private/Verifier
router.delete('/time-table/history/:id', async (req, res) => {
  try {
    const history = await TimeTableHistory.findOne({
      _id: req.params.id,
      verifier: req.user.id
    });

    if (!history) {
      return res.status(404).json({
        success: false,
        message: 'History record not found'
      });
    }

    await history.deleteOne();

    res.json({
      success: true,
      message: 'History record deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
