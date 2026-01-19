const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Workspace = require('./models/Workspace');

dotenv.config();

const seedDatabase = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing data (optional - be careful in production)
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Workspace.deleteMany({});

    // Create Workspace 1
    console.log('Creating Workspace 1...');
    const workspace1 = await Workspace.create({
      name: 'Workspace 1',
      workspaceId: 1,
      description: 'Main workspace for the organization'
    });
    console.log('Workspace 1 created:', workspace1);

    // Create IT Admin (you)
    console.log('Creating IT Admin...');
    const itAdmin = await User.create({
      name: 'IT Admin',
      email: 'techsupport@mecstudio.com',
      password: 'Admin',
      role: 'it_admin',
      isFirstLogin: true,
      isActive: true
    });
    console.log('IT Admin created');

    // Create Workflow Coordinator
    console.log('Creating Workflow Coordinator...');
    const workflowCoordinator = await User.create({
      name: 'Workflow Coordinator',
      email: 'hsjwebdev04@gmail.com',
      password: 'Admin',
      role: 'workflow_coordinator',
      workspace: workspace1._id,
      isFirstLogin: true,
      isActive: true
    });
    console.log('Workflow Coordinator created');

    // Create Team Lead
    console.log('Creating Team Lead...');
    const teamLead = await User.create({
      name: 'Team Lead',
      email: 'hsjain4204@gmail.com',
      password: 'Admin',
      role: 'team_lead',
      workspace: workspace1._id,
      isFirstLogin: true,
      isActive: true
    });
    console.log('Team Lead created');

    // Create Team Member
    console.log('Creating Team Member...');
    const teamMember = await User.create({
      name: 'Team Member',
      email: 'hsjai4204@gmail.com',
      password: 'Admin',
      role: 'team_member',
      workspace: workspace1._id,
      teamLead: teamLead._id,
      isFirstLogin: true,
      isActive: true
    });
    console.log('Team Member created');

    console.log('\n=================================');
    console.log('Database seeded successfully!');
    console.log('=================================');
    console.log('\nCreated users:');
    console.log('1. IT Admin: techsupport@mecstudio.com (Password: Admin)');
    console.log('2. Workflow Coordinator: hsjwebdev04@gmail.com (Password: Admin)');
    console.log('3. Team Lead: hsjain4204@gmail.com (Password: Admin)');
    console.log('4. Team Member: hsjai4204@gmail.com (Password: Admin)');
    console.log('\nAll users must reset their password on first login');
    console.log('=================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedDatabase();
