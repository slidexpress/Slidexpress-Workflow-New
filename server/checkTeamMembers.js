const mongoose = require('mongoose');
const TeamMember = require('./models/TeamMember');
require('dotenv').config();

async function checkTeamMembers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Fetch all team members
    const teamMembers = await TeamMember.find();

    console.log(`Found ${teamMembers.length} team members:\n`);

    // Group by team lead
    const grouped = {};
    teamMembers.forEach(member => {
      if (!grouped[member.tlName]) {
        grouped[member.tlName] = [];
      }
      grouped[member.tlName].push(member.name);
    });

    // Display grouped data
    console.log('Team Structure (Grouped by Team Leader):');
    Object.entries(grouped).forEach(([lead, members]) => {
      console.log(`  ${lead}:`);
      members.forEach(member => console.log(`    - ${member}`));
    });

    console.log('\nAll team members:');
    teamMembers.forEach(member => {
      console.log(`  - ${member.name} (TL: ${member.tlName}, Team: ${member.teamName}) - ${member.emailId || 'No email'}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error checking team members:', error);
    process.exit(1);
  }
}

checkTeamMembers();
