const nodemailer = require("nodemailer");
const EMP_EMAILS = require("./employeeEmails");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

module.exports = async function sendAssignmentMail(ticket) {
  const toEmail = EMP_EMAILS[ticket.assignedInfo.empName];
  if (!toEmail) return;

  try {
    await transporter.sendMail({
      from: `"Job System" <${process.env.MAIL_USER}>`,
      to: toEmail,
      subject: `New Job Assigned – ${ticket.jobId}`,
      html: `
        <h3>New Job Assigned</h3>
        <p><b>Job ID:</b> ${ticket.jobId}</p>
        <p><b>Client:</b> ${ticket.clientName}</p>
        <p><b>Consultant:</b> ${ticket.consultantName}</p>
        <p><b>Subject:</b> ${ticket.subject}</p>
        <p><b>Message:</b> ${ticket.message || "-"}</p>
      `,
    });
    console.log(`Assignment email sent to ${toEmail}`);
  } catch (error) {
    console.error(`Failed to send assignment email to ${toEmail}:`, error);
  }
};
