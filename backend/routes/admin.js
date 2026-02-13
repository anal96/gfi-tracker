import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import User from '../models/User.js';
import UnitLog from '../models/UnitLog.js';
import DailyTimeSlot from '../models/DailyTimeSlot.js';
import Subject from '../models/Subject.js';
import SubjectAssignment from '../models/SubjectAssignment.js';
import Approval from '../models/Approval.js';
import { sendEmail, getWelcomeEmailTemplate, getAccountDeletionEmailTemplate } from '../utils/emailService.js';

const router = express.Router();

// All routes require admin role
router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard data
// @access  Private/Admin
router.get('/dashboard', async (req, res) => {
  try {
    const { teacherId, subject, dateRange } = req.query;

    // Build filter
    const filter = {};
    if (teacherId && teacherId !== 'all') {
      // If teacherId is a name, look up the teacher by name
      const teacher = await User.findOne({ name: teacherId, role: 'teacher' });
      if (teacher) {
        filter.teacher = teacher._id;
      } else {
        // If not found by name, try as ObjectId
        filter.teacher = teacherId;
      }
    }

    // Get all unit logs with filters - show both in-progress and completed units
    let unitLogs = await UnitLog.find({ ...filter, status: { $in: ['in-progress', 'completed'] } })
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
      .sort({ createdAt: -1 });

    // Apply subject filter
    if (subject && subject !== 'all') {
      unitLogs = unitLogs.filter(log => log.subject && log.subject.name === subject);
    }

    // Apply date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let startDate = new Date();

      switch (dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
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

    // Filter out logs with null populated fields
    const validLogs = unitLogs.filter(log => 
      log && log._id && 
      log.teacher && log.teacher._id && 
      log.subject && log.subject._id && 
      log.unit && log.unit._id
    );

    // Get total registered teachers count
    const totalTeachersCount = await User.countDocuments({ role: 'teacher' });
    console.log('📊 Admin Dashboard: Total Teachers Count:', totalTeachersCount);

    // Calculate metrics - include both in-progress and completed
    const uniqueTeachers = totalTeachersCount;
    const completedUnits = validLogs.filter(log => log.status === 'completed').length;
    const inProgressUnits = validLogs.filter(log => log.status === 'in-progress').length;
    const totalHours = validLogs.reduce((sum, log) => {
      if (log.status === 'completed' && log.totalMinutes) {
        return sum + (log.totalMinutes / 60);
      } else if (log.status === 'in-progress') {
        const elapsedMs = new Date() - log.startTime;
        return sum + (elapsedMs / (1000 * 60 * 60));
      }
      return sum;
    }, 0);
    const activeUnits = completedUnits + inProgressUnits;
    const avgHours = activeUnits > 0 ? (totalHours / activeUnits) : 0;
    
    // Round to integer as requested ("remove the .")
    const roundedAvgHours = Math.floor(avgHours);

    // Format data for frontend
    const formattedData = validLogs.map(log => {
      let totalHours = 0;
      let progressDays = 0;
      
      if (log.status === 'completed' && log.totalMinutes) {
        totalHours = log.totalMinutes / 60;
      } else if (log.status === 'in-progress') {
        const elapsedMs = new Date() - log.startTime;
        totalHours = elapsedMs / (1000 * 60 * 60);
        // Calculate days since start (progress shows from day 2)
        const daysSinceStart = Math.floor((new Date() - log.startTime) / (1000 * 60 * 60 * 24));
        progressDays = daysSinceStart >= 1 ? daysSinceStart : 0; // Show from day 2 (index 1 = day 2)
      }

      return {
        id: log._id.toString(),
        teacherName: log.teacher?.name || 'Unknown Teacher',
        subject: log.subject?.name || 'Unknown Subject',
        unit: log.unit?.name || 'Unknown Unit',
        startedAt: log.startTime,
        completedAt: log.endTime || null,
        totalHours: totalHours,
        status: log.status,
        progressDays: progressDays
      };
    });

    // No delayed units shown
    const delayedUnits = [];

    // Get unique teachers and subjects for filters - include both in-progress and completed
    const allLogs = await UnitLog.find({ status: { $in: ['in-progress', 'completed'] } })
      .populate({
        path: 'teacher',
        select: 'name',
        strictPopulate: false
      })
      .populate({
        path: 'subject',
        select: 'name',
        strictPopulate: false
    });

    // Filter out logs with null populated fields and extract names
    const validAllLogs = allLogs.filter(log => 
      log && log.teacher && log.teacher.name && 
      log.subject && log.subject.name
    );
    
    const teachers = Array.from(new Set(
      validAllLogs.map(log => log.teacher.name).filter(name => name)
    ));
    const subjects = Array.from(new Set(
      validAllLogs.map(log => log.subject.name).filter(name => name)
    ));

    res.json({
      success: true,
      data: {
        metrics: {
          totalTeachers: uniqueTeachers,
          completedUnits,
          inProgressUnits,
          avgHours: roundedAvgHours.toString()
        },
        unitLogs: formattedData,
        delayedUnits,
        filters: {
          teachers: ['all', ...teachers],
          subjects: ['all', ...subjects]
        }
      }
    });
  } catch (error) {
    console.error('Error in /admin/dashboard:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load admin dashboard data'
    });
  }
});

// @route   GET /api/admin/teachers
// @desc    Get all teachers
// @access  Private/Admin
router.get('/teachers', async (req, res) => {
  try {
    const teachers = await User.find({ role: 'teacher' })
      .select('-password')
      .populate('subjects');

    res.json({
      success: true,
      data: teachers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/progress
// @desc    Get progress visualization data
// @access  Private/Admin
router.get('/progress', async (req, res) => {
  try {
    const { teacherId, subject, groupBy, dateRange } = req.query;

    const filter = {};
    if (teacherId && teacherId !== 'all') {
      // If teacherId is a name, look up the teacher by name
      const teacher = await User.findOne({ name: teacherId, role: 'teacher' });
      if (teacher) {
        filter.teacher = teacher._id;
      } else {
        // If not found by name, try as ObjectId
        filter.teacher = teacherId;
      }
    }
    if (subject && subject !== 'all') {
      const subjectDoc = await Subject.findOne({ name: subject });
      if (subjectDoc) filter.subject = subjectDoc._id;
    }

    // Apply date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let startDate = new Date();
      
      switch (dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
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
      
      filter.createdAt = { $gte: startDate };
    }
    
    console.log('🔍 Progress Route Filter:', JSON.stringify(filter, null, 2));

    // Show both completed and in-progress units for comprehensive stats
    const unitLogs = await UnitLog.find({ ...filter, status: { $in: ['completed', 'in-progress'] } })
      .populate('subject', 'name')
      .populate('unit', 'name')
      .populate('teacher', 'name');

    // Group data
    // Initialize groupedData with all relevant entities (to show 0s)
    const groupedData = {};
    
    if (groupBy === 'teacher') {
      const userFilter = { role: 'teacher' };
      if (filter.teacher) userFilter._id = filter.teacher;
      
      const teachers = await User.find(userFilter).select('name');
      teachers.forEach(t => {
        groupedData[t.name] = { 
          total: 0, 
          completed: 0, 
          inProgress: 0, 
          delayed: 0, 
          totalHours: 0 
        };
      });
    } else {
      // Default: Group by subject
      const subjectFilter = {};
      if (filter.subject) subjectFilter._id = filter.subject;
      
      const subjects = await Subject.find(subjectFilter).select('name');
      subjects.forEach(s => {
        groupedData[s.name] = { 
          total: 0, 
          completed: 0, 
          inProgress: 0, 
          delayed: 0, 
          totalHours: 0 
        };
      });
    }
    unitLogs.forEach(log => {
      // Determine grouping key
      let groupKey;
      if (groupBy === 'teacher') {
        groupKey = log.teacher ? log.teacher.name : 'Unknown Teacher';
      } else {
        // Default to grouping by subject
        if (!log.subject || !log.subject.name) return;
        groupKey = log.subject.name;
      }

      if (!groupedData[groupKey]) {
        groupedData[groupKey] = {
          total: 0,
          completed: 0,
          inProgress: 0,
          delayed: 0,
          totalHours: 0
        };
      }

      groupedData[groupKey].total += 1;
      
      if (log.status === 'completed') {
        groupedData[groupKey].completed += 1;
        groupedData[groupKey].totalHours += (log.totalMinutes || 0) / 60;
      } else if (log.status === 'in-progress') {
        const hours = (new Date() - log.startTime) / (1000 * 60 * 60);
        groupedData[groupKey].totalHours += hours;
        
        if (hours > 12) {
          groupedData[groupKey].delayed += 1;
        } else {
          groupedData[groupKey].inProgress += 1;
        }
      }
    });

    // Format for frontend
    const formatted = Object.entries(groupedData).map(([key, stats]) => ({
      name: key, // Use universal 'name' field (works for subject or teacher)
      subject: key, // Keep 'subject' for backward compatibility
      ...stats,
      avgHours: stats.completed > 0 ? stats.totalHours / stats.completed : 0
    }));

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/assignments
// @desc    Get all subject assignment requests
// @access  Private/Admin
router.get('/assignments', async (req, res) => {
  try {
    const { status } = req.query;
    
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    const assignments = await SubjectAssignment.find(filter)
      .populate({
        path: 'fromTeacher',
        select: 'name email',
        strictPopulate: false
      })
      .populate({
        path: 'toTeacher',
        select: 'name email',
        strictPopulate: false
      })
      .populate({
        path: 'subject',
        select: 'name',
        strictPopulate: false
      })
      .populate({
        path: 'remainingUnits',
        select: 'name order',
        strictPopulate: false
      })
      .populate({
        path: 'requestedBy',
        select: 'name email',
        strictPopulate: false
      })
      .populate({
        path: 'approvedBy',
        select: 'name email',
        strictPopulate: false
      })
      .sort({ createdAt: -1 })
      .lean();
    
    // Filter and clean assignments
    const validAssignments = assignments
      .filter(assignment => {
        if (!assignment || !assignment._id) return false;
        if (!assignment.fromTeacher || !assignment.fromTeacher._id) return false;
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
      }));
    
    res.json({
      success: true,
      data: validAssignments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/admin/assignments/:assignmentId/approve
// @desc    Approve a subject assignment request
// @access  Private/Admin
router.post('/assignments/:assignmentId/approve', async (req, res) => {
  try {
    const adminId = req.user.id;
    const { assignmentId } = req.params;
    
    const assignment = await SubjectAssignment.findById(assignmentId)
      .populate('subject')
      .populate('fromTeacher')
      .populate('toTeacher');
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment request not found'
      });
    }
    
    if (assignment.status === 'admin_approved') {
      return res.json({
        success: true,
        message: 'Already sent to teacher for approval',
        data: assignment
      });
    }
    if (assignment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This assignment has already been ${assignment.status}`
      });
    }

    // Admin approves: send to teacher for approval (no transfer yet)
    assignment.status = 'admin_approved';
    assignment.approvedBy = adminId;
    assignment.approvedAt = new Date();
    await assignment.save();

    // Create Approval record for Verifier notification
    await Approval.create({
      type: 'subject-assign',
      status: 'approved',
      requestedBy: assignment.requestedBy,
      approvedBy: adminId,
      approvedAt: new Date(),
      requestData: {
        assignmentId: assignment._id,
        subjectName: assignment.subject?.name || 'Subject',
        toTeacherName: assignment.toTeacher?.name,
        approvedBy: 'admin'
      }
    });

    res.json({
      success: true,
      message: 'Assignment approved by admin. Sent to teacher for final acceptance.',
      data: assignment
    });
  } catch (error) {
    console.error('Error approving assignment:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/admin/assignments/:assignmentId/reject
// @desc    Reject a subject assignment request
// @access  Private/Admin
router.post('/assignments/:assignmentId/reject', async (req, res) => {
  try {
    const adminId = req.user.id;
    const { assignmentId } = req.params;
    const { reason } = req.body;
    
    const assignment = await SubjectAssignment.findById(assignmentId)
      .populate('subject', 'name')
      .populate('toTeacher', 'name email');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment request not found'
      });
    }
    
    if (assignment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This assignment has already been ${assignment.status}`
      });
    }
    
    assignment.status = 'rejected';
    assignment.approvedBy = adminId;
    assignment.rejectionReason = reason || 'No reason provided';
    assignment.rejectedAt = new Date();
    await assignment.save();

    // Notify verifier (create Approval so verifier sees in notifications)
    await assignment.populate([{ path: 'subject', select: 'name' }, { path: 'toTeacher', select: 'name email' }]);
    await Approval.create({
      type: 'subject-assign',
      status: 'rejected',
      requestedBy: assignment.requestedBy,
      approvedBy: adminId,
      rejectionReason: reason || 'No reason provided',
      rejectedAt: new Date(),
      requestData: {
        assignmentId: assignment._id,
        subjectName: assignment.subject?.name || 'Subject',
        toTeacherName: assignment.toTeacher?.name,
        rejectedBy: 'admin'
      }
    });

    res.json({
      success: true,
      message: 'Subject assignment request rejected',
      data: assignment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/notifications
// @desc    Get pending assignment requests (for admin notifications page)
// @access  Private/Admin
router.get('/notifications', async (req, res) => {
  try {
    // Find ALL assignments so admin can see history (pending, approved, rejected)
    const assignments = await SubjectAssignment.find({})
      .populate('fromTeacher', 'name email')
      .populate('toTeacher', 'name email')
      .populate('subject', 'name')
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Count by status for debugging
    const byState = assignments.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {});
    console.log(`📋 Admin Notifications: Fetched ${assignments.length} assignments. Breakdown:`, byState);

    res.json({
      success: true,
      data: assignments.map(a => ({
        _id: a._id,
        type: 'subject-assign',
        status: a.status,
        requestData: {
          assignmentId: a._id,
          subjectName: a.subject?.name,
          fromTeacherName: a.fromTeacher?.name,
          toTeacherName: a.toTeacher?.name,
          verifierName: (a.requestedBy && (a.requestedBy.name || a.requestedBy.email)) ? (a.requestedBy.name || a.requestedBy.email) : null,
          verifierEmail: a.requestedBy?.email,
          reason: a.reason
        },
        createdAt: a.createdAt,
        approvedAt: a.approvedAt,
        rejectedAt: a.rejectedAt,
        rejectionReason: a.rejectionReason,
        requestedBy: a.requestedBy ? { _id: a.requestedBy._id, name: a.requestedBy.name, email: a.requestedBy.email } : null,
        approvedBy: a.approvedBy ? { _id: a.approvedBy._id, name: a.approvedBy.name, email: a.approvedBy.email } : null
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private/Admin
router.get('/users', async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('subjects', 'name')
      .sort({ createdAt: -1 });
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/admin/users
// @desc    Create a new user
// @access  Private/Admin
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    console.log('📝 Creating user:', { name, email, role, passwordLength: password ? password.length : 0 });

    // Explicit validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email and password'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'teacher'
    });

    console.log('✅ User created successfully:', user._id);

    // Send Welcome Email
    try {
      const emailHtml = getWelcomeEmailTemplate(name, email, password);
      await sendEmail({
        to: email,
        subject: 'Welcome to GFI Tracker!',
        html: emailHtml
      });
      console.log('📧 Welcome email sent to:', email);
    } catch (emailErr) {
      console.error('❌ Failed to send welcome email:', emailErr);
    }

    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('❌ Create User Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update a user
// @access  Private/Admin
router.put('/users/:id', async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check email uniqueness if changed
    if (email && email !== user.email) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
      user.email = email;
    }

    if (name) user.name = name;
    if (role) user.role = role;
    if (password) user.password = password;

    await user.save();

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete a user
// @access  Private/Admin
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting self
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete yourself'
      });
    }

    // Send Deletion Email
    try {
      const emailHtml = getAccountDeletionEmailTemplate(user.name);
      await sendEmail({
        to: user.email,
        subject: 'Account Deletion Notice - GFI Tracker',
        html: emailHtml
      });
      console.log('📧 Deletion email sent to:', user.email);
    } catch (emailErr) {
      console.error('❌ Failed to send deletion email:', emailErr);
    }

    await user.deleteOne();

    res.json({
      success: true,
      message: 'User deleted successfully',
      data: { id: req.params.id }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
