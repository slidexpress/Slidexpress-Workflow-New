import axios from "axios";

export const emailAPI = {
  getAllEmails: () => axios.get("/api/emails"),
  syncEmails: () => axios.get("/api/emails/sync"),
  getEmailById: (id) => axios.get(`/api/emails/${id}`),
  deleteEmail: (id) => axios.delete(`/api/emails/${id}`),
  downloadAttachment: (id, i) => axios.get(`/api/emails/${id}/attachments/${i}`, { responseType: "blob" }),
};

export const ticketAPI = {
  createTicket: (ticketData) => axios.post("/api/tickets", ticketData),
};
