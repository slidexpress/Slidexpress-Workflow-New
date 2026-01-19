import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ticketAPI } from "../utils/api";

const EmailsPage = () => {
  const { jobId } = useParams();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const res = await ticketAPI.getEmailsByJobId(jobId);
        setEmails(res.data?.emails || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchEmails();
  }, [jobId]);

  return (
    <div className="p-4">
      <h2 className="font-bold text-lg mb-4">Emails for Job ID: {jobId}</h2>

      {loading && <p>Loading...</p>}
      {!loading && emails.length === 0 && <p>No emails found.</p>}

      {emails.map((mail, i) => (
        <div key={i} className="border p-3 mb-3 rounded">
          <div><b>From:</b> {mail.from}</div>
          <div><b>To:</b> {mail.to}</div>
          <div><b>Subject:</b> {mail.subject}</div>
          <div className="text-gray-600 mt-1">{mail.body}</div>
        </div>
      ))}
    </div>
  );
};

export default EmailsPage;
