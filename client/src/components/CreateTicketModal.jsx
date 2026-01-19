import { useEffect, useRef } from "react";

/* ===============================
   DATE FORMATTER
================================ */
const formatDateTime = (date) => {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
};

/* ===============================
   SAFE AUTO CREATE
================================ */
const CreateTicketModal = ({ ticketData, onCreate }) => {
  const createdRef = useRef(false);

  useEffect(() => {
    if (!ticketData) return;
    if (createdRef.current) return;

    // ✅ ONLY create once, when jobId exists
    if (!ticketData.jobId) return;

    createdRef.current = true;

    onCreate({
      ...ticketData,
      createdAt: ticketData.createdAt || formatDateTime(new Date()),
      status: ticketData.status || "not_assigned",
      emails: ticketData.emails ?? [],
    });
  }, [ticketData, onCreate]);

  return null;
};

export default CreateTicketModal;
