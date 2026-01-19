const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const { authenticate, isITAdmin, authorize } = require('../middleware/auth');

// Get all users (IT Admin and Super Admin only)
router.get('/', authenticate, isITAdmin, async (req, res) => {
  try {
    const { workspace, role } = req.query;

    let query = {};

    if (workspace) {
      query.workspace = workspace;
    }

    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .populate('workspace', 'name workspaceId')
      .populate('teamLead', 'name email role')
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get team leads for a workspace
router.get('/team-leads/:workspaceId', authenticate, isITAdmin, async (req, res) => {
  try {
    const workspace = await Workspace.findOne({ workspaceId: req.params.workspaceId });

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const teamLeads = await User.find({
      workspace: workspace._id,
      role: 'team_lead',
      isActive: true
    }).select('_id name email');

    res.json({ teamLeads });
  } catch (error) {
    console.error('Get team leads error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add new user (IT Admin only)
router.post('/', authenticate, isITAdmin, async (req, res) => {
  try {
    const { name, email, role, workspaceId, teamLeadId } = req.body;

    // Validate required fields
    if (!name || !email || !role) {
      return res.status(400).json({ message: 'Name, email and role are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Validate workspace for non-admin roles
    if (role !== 'super_admin' && role !== 'it_admin' && !workspaceId) {
      return res.status(400).json({ message: 'Workspace is required for this role' });
    }

    let workspace = null;
    if (workspaceId) {
      workspace = await Workspace.findOne({ workspaceId });
      if (!workspace) {
        return res.status(404).json({ message: 'Workspace not found' });
      }
    }

    // Validate team lead for team members
    if (role === 'team_member' && !teamLeadId) {
      return res.status(400).json({ message: 'Team lead is required for team members' });
    }

    // Create user object
    const userData = {
      name,
      email,
      password: 'Admin', // Default password
      role,
      isFirstLogin: true,
      isActive: true
    };

    if (workspace) {
      userData.workspace = workspace._id;
    }

    if (teamLeadId) {
      userData.teamLead = teamLeadId;
    }

    const user = await User.create(userData);

    const populatedUser = await User.findById(user._id)
      .populate('workspace', 'name workspaceId')
      .populate('teamLead', 'name email role')
      .select('-password');

    res.status(201).json({
      message: 'User created successfully',
      user: populatedUser
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user (IT Admin only)
router.put('/:id', authenticate, isITAdmin, async (req, res) => {
  try {
    const { name, role, workspaceId, teamLeadId, isActive } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields if provided
    if (name) user.name = name;
    if (role) user.role = role;
    if (typeof isActive !== 'undefined') user.isActive = isActive;

    if (workspaceId) {
      const workspace = await Workspace.findOne({ workspaceId });
      if (!workspace) {
        return res.status(404).json({ message: 'Workspace not found' });
      }
      user.workspace = workspace._id;
    }

    if (teamLeadId) {
      user.teamLead = teamLeadId;
    }

    user.updatedAt = Date.now();
    await user.save();

    const updatedUser = await User.findById(user._id)
      .populate('workspace', 'name workspaceId')
      .populate('teamLead', 'name email role')
      .select('-password');

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete user (IT Admin only)
router.delete('/:id', authenticate, isITAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all workspaces
router.get('/workspaces/all', authenticate, isITAdmin, async (req, res) => {
  try {
    const workspaces = await Workspace.find().sort({ workspaceId: 1 });
    res.json({ workspaces });
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
