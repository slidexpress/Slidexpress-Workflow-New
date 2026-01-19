const mongoose = require('mongoose');
const TeamMember = require('./models/TeamMember');
require('dotenv').config();

// Helper function to generate email from name
function generateEmail(name) {
  return name.toLowerCase()
    .trim()
    .replace(/\s+/g, '.')
    .replace(/[^a-z.]/g, '') + '@mecstudio.com';
}

// Team members data organized by color teams
const teamMembersData = [
  // Purple Team (TL: Yogindra Vanmali)
  { name: 'Isha Gupta', tlName: 'Yogindra Vanmali', teamName: 'Purple' },
  { name: 'Kalpesh Thakur', tlName: 'Yogindra Vanmali', teamName: 'Purple' },
  { name: 'Mallika Kale', tlName: 'Yogindra Vanmali', teamName: 'Purple' },
  { name: 'Parthavi Buddhadev', tlName: 'Yogindra Vanmali', teamName: 'Purple' },
  { name: 'Pavaneshwari Aileri', tlName: 'Yogindra Vanmali', teamName: 'Purple' },
  { name: 'Trisha Bodke', tlName: 'Yogindra Vanmali', teamName: 'Purple' },
  { name: 'Yadnesh Dhabade', tlName: 'Yogindra Vanmali', teamName: 'Purple' },
  { name: 'Yogesh Yadav', tlName: 'Yogindra Vanmali', teamName: 'Purple' },
  { name: 'Srushti Patil', tlName: 'Yogindra Vanmali', teamName: 'Purple' },

  // Yellow Team (TL: Kavish Dandekar)
  { name: 'Arbaaz Shaikh', tlName: 'Kavish Dandekar', teamName: 'Yellow' },
  { name: 'Kartik Waghela', tlName: 'Kavish Dandekar', teamName: 'Yellow' },
  { name: 'Mahua Kothari', tlName: 'Kavish Dandekar', teamName: 'Yellow' },
  { name: 'Maseera Ansari', tlName: 'Kavish Dandekar', teamName: 'Yellow' },
  { name: 'Nitesh Colaco', tlName: 'Kavish Dandekar', teamName: 'Yellow' },
  { name: 'Pradnya Bhatkar', tlName: 'Kavish Dandekar', teamName: 'Yellow' },
  { name: 'Sachin Sharma', tlName: 'Kavish Dandekar', teamName: 'Yellow' },
  { name: 'Yusuf Shaikh', tlName: 'Kavish Dandekar', teamName: 'Yellow' },

  // Green Team (TL: Kalpesh Hire)
  { name: 'David Pansuriya', tlName: 'Kalpesh Hire', teamName: 'Green' },
  { name: 'Jayram Vishwakarma', tlName: 'Kalpesh Hire', teamName: 'Green' },
  { name: 'Kinjal Dhakad', tlName: 'Kalpesh Hire', teamName: 'Green' },
  { name: 'Naziya Khan', tlName: 'Kalpesh Hire', teamName: 'Green' },
  { name: 'Rimsha Syeed', tlName: 'Kalpesh Hire', teamName: 'Green' },
  { name: 'Saravanakumar Nadar', tlName: 'Kalpesh Hire', teamName: 'Green' },
  { name: 'Shubham Mahtre', tlName: 'Kalpesh Hire', teamName: 'Green' },
  { name: 'Vishal Pednekar', tlName: 'Kalpesh Hire', teamName: 'Green' },
  { name: 'Anish Balakrishnan', tlName: 'Kalpesh Hire', teamName: 'Green' },

  // Blue Team (TL: Pratik Chavan)
  { name: 'Ankita Kasbe', tlName: 'Pratik Chavan', teamName: 'Blue' },
  { name: 'Dhananjay Suryavanshi', tlName: 'Pratik Chavan', teamName: 'Blue' },
  { name: 'Ekta Adangale', tlName: 'Pratik Chavan', teamName: 'Blue' },
  { name: 'Mansi Kumbhar', tlName: 'Pratik Chavan', teamName: 'Blue' },
  { name: 'Pramod Prasad', tlName: 'Pratik Chavan', teamName: 'Blue' },
  { name: 'Rohit Naga', tlName: 'Pratik Chavan', teamName: 'Blue' },
  { name: 'Sana  Mulla', tlName: 'Pratik Chavan', teamName: 'Blue' },
  { name: 'Shaima Shaikh', tlName: 'Pratik Chavan', teamName: 'Blue' },
  { name: 'Yogesh Molawade', tlName: 'Pratik Chavan', teamName: 'Blue' },

  // Red Team (TL: Anand Mishra)
  { name: 'Amey Sawant', tlName: 'Anand Mishra', teamName: 'Red' },
  { name: 'Deepak Maharana', tlName: 'Anand Mishra', teamName: 'Red' },
  { name: 'Harsh Ayer', tlName: 'Anand Mishra', teamName: 'Red' },
  { name: 'Jayesh thorat', tlName: 'Anand Mishra', teamName: 'Red' },
  { name: 'Seema Tak', tlName: 'Anand Mishra', teamName: 'Red' },
  { name: 'Ritesh Narkar', tlName: 'Anand Mishra', teamName: 'Red' },
  { name: 'Prakash Choudhary', tlName: 'Anand Mishra', teamName: 'Red' },
  { name: 'Samidha Valanju', tlName: 'Anand Mishra', teamName: 'Red' },
  { name: 'Ketan Manjarekar', tlName: 'Anand Mishra', teamName: 'Red' }
];

// Add generated emails to each team member
const sampleTeamMembers = teamMembersData.map(member => ({
  ...member,
  emailId: generateEmail(member.name)
}));

async function seedTeamMembers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing team members (optional)
    await TeamMember.deleteMany({});
    console.log('Cleared existing team members');

    // Insert sample team members
    const inserted = await TeamMember.insertMany(sampleTeamMembers);
    console.log(`Inserted ${inserted.length} team members:`);

    // Group by team color for display
    const byTeam = {};
    inserted.forEach(member => {
      if (!byTeam[member.teamName]) {
        byTeam[member.teamName] = [];
      }
      byTeam[member.teamName].push(member.name);
    });

    // Display by team
    Object.entries(byTeam).forEach(([teamName, members]) => {
      console.log(`\n${teamName} Team (${members.length} members):`);
      members.forEach(name => console.log(`  - ${name}`));
    });

    console.log('\nSeed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding team members:', error);
    process.exit(1);
  }
}

seedTeamMembers();
