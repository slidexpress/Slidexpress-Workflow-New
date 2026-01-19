// src/pages/Mail.jsx
// ============================================================================
// IMPORTANT: Starred Gmail emails now automatically create tickets with "not_assigned" status
// This means starred emails will NOT appear in this Mail page - they go directly to tickets
// This page will only show emails that somehow didn't get auto-converted (rare edge cases)
// ============================================================================
import { useState, useEffect, useRef } from "react";
import { emailAPI } from "../utils/api";
import CreateTicketModal from "../components/CreateTicketModal";
import axios from "axios";

const Mail = () => {
  const [emails, setEmails] = useState([]);
  const [filteredEmails, setFilteredEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingEmailContent, setLoadingEmailContent] = useState(false);
  const [emailFetchError, setEmailFetchError] = useState(null);
  const [failedEmailId, setFailedEmailId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [isBackgroundSync, setIsBackgroundSync] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketData, setTicketData] = useState(null);

  // Multiple email selection
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [showExistingTicketModal, setShowExistingTicketModal] = useState(false);
  const [existingTickets, setExistingTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Bulk ticket creation
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const [creatingTickets, setCreatingTickets] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalEmails, setTotalEmails] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Prefetch abort controller for canceling in-flight requests
  const prefetchAbortRef = useRef(null);

  // Client-side cache for loaded emails (keeps full content in memory + localStorage)
  const [emailCache, setEmailCache] = useState(() => {
    try {
      const cached = localStorage.getItem('emailCache');
      return cached ? JSON.parse(cached) : {};
    } catch (e) {
      console.error('Failed to load email cache from localStorage:', e);
      return {};
    }
  });

  // Persist email cache to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('emailCache', JSON.stringify(emailCache));
    } catch (e) {
      console.error('Failed to save email cache to localStorage:', e);
    }
  }, [emailCache]);

  // Escape key handler for modals
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        if (showTicketModal) {
          setShowTicketModal(false);
        }
        if (showExistingTicketModal) {
          setShowExistingTicketModal(false);
        }
        if (showBulkCreateModal) {
          setShowBulkCreateModal(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showTicketModal, showExistingTicketModal, showBulkCreateModal]);

 useEffect(() => {
  // ⚡ INSTANT LOAD: Only cached/database data first
  const loadInitialData = async () => {
    setLoading(true);
    await fetchEmails(false, 0);
    setLoading(false);
  };
  
  loadInitialData();
  
  // 🚀 DEBOUNCE heavy sync (don't run immediately)
  const timeoutId = setTimeout(() => {
    syncEmails(true); // Background only
  }, 1000); // Wait 1s after navigation
  
  // 🔄 Longer auto-sync interval
  const syncInterval = setInterval(() => syncEmails(true), 30000); // 30s instead of 15s
  
  return () => {
    clearTimeout(timeoutId);
    clearInterval(syncInterval);
    if (prefetchAbortRef.current) {
      prefetchAbortRef.current.abort();
    }
  };
}, []);


  // Make all links in email content open in new tab
  useEffect(() => {
    if (selectedEmail?.body?.html) {
      const emailContent = document.querySelector('.email-content');
      if (emailContent) {
        const links = emailContent.querySelectorAll('a');
        links.forEach(link => {
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        });
      }
    }
  }, [selectedEmail]);

  useEffect(() => {
    applyFilter(filter);
  }, [emails, filter]);

  const fetchEmails = async (isBackground = true, page = 0) => {
    try {
      // Don't show loading spinner for background fetches
      if (!isBackground && !loadingMore) {
        setLoading(true);
      }

      const response = await emailAPI.getAllEmails(page);
      const newEmails = response.data.emails;
      const pagination = response.data.pagination;

      // Update pagination info
      if (pagination) {
        setTotalPages(pagination.pages);
        setTotalEmails(pagination.total);
      }

      // ============================================================================
      // NOTE: Starred Gmail emails now automatically create tickets with "not_assigned" status
      // This means all starred emails will have a jobId and won't appear in the Mail page
      // The filter below ensures only emails without tickets are shown (which should be none)
      // ============================================================================

      // Filter out emails that are already linked to tickets (have jobId)
      const unlinkedEmails = newEmails.filter(email => !email.jobId);

      // For new page, replace. For loading more, append.
      if (page === 0) {
        setEmails(unlinkedEmails);
        setCurrentPage(0);
      } else {
        setEmails(prev => [...prev, ...unlinkedEmails]);
      }
      
      // Prefetch first few email bodies immediately in parallel
      setTimeout(() => {
        const emailsToPreload = page === 0 ? unlinkedEmails.slice(0, 3) : unlinkedEmails.slice(0, 2);
        prefetchEmailBodiesParallel(emailsToPreload);
      }, 50);

      // Set loading to false once first fetch completes
      if (loading || loadingMore) {
        setLoading(false);
        setLoadingMore(false);
      }
    } catch (error) {
      console.log("Failed to load emails");
      // Still set loading to false on error
      if (loading || loadingMore) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  // Parallel prefetch with abort controller
  const prefetchEmailBodiesParallel = async (emailsToPreload) => {
    if (!emailsToPreload || emailsToPreload.length === 0) return;
    
    // Cancel previous prefetch requests
    if (prefetchAbortRef.current) {
      prefetchAbortRef.current.abort();
    }
    prefetchAbortRef.current = new AbortController();

    // Fetch all 3 emails in parallel (not sequentially)
    const fetchPromises = emailsToPreload.map(async (email) => {
      if (emailCache[email._id]) return; // Already cached
      
      try {
        const res = await emailAPI.getEmailById(email._id);
        const emailData = res.data.email;
        
        if (emailData.body?.html && emailData.attachments) {
          emailData.body.html = processCIDImages(emailData.body.html, emailData.attachments);
        }
        
        setEmailCache(prev => ({ ...prev, [email._id]: emailData }));
      } catch (err) {
        console.error(`Failed to prefetch email ${email._id}:`, err.message);
      }
    });

    // Start all requests in parallel but don't wait for all to complete
    Promise.allSettled(fetchPromises).catch(() => {
      // Silently fail - prefetch is non-blocking
    });
  };

  const syncEmails = async (isBackground = true) => {
    try {
      // Set background sync indicator
      if (isBackground) {
        setIsBackgroundSync(true);
      }

      const response = await emailAPI.syncEmails();

      // Always fetch emails to reflect both additions and removals (unstarred emails)
      await fetchEmails(true, 0); // Always use background mode and reset to page 0

      // Update last sync time
      setLastSyncTime(new Date());
    } catch (error) {
      // Silently fail for background syncs to avoid console spam
      if (!isBackground) {
        console.error("Email sync error:", error);
      }
    } finally {
      if (isBackground) {
        setIsBackgroundSync(false);
      }
    }
  };

  // Helper function to convert array of bytes to base64 (browser-compatible)
  const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Helper function to convert CID references to data URLs for inline images
  const processCIDImages = (htmlContent, attachments) => {
    if (!htmlContent || !attachments || attachments.length === 0) {
      return htmlContent;
    }

    let processedHtml = htmlContent;

    // Find all attachments with contentId (inline images)
    attachments.forEach((attachment) => {
      if (attachment.contentId && attachment.content) {
        // Remove < and > from contentId if present
        const cid = attachment.contentId.replace(/^<|>$/g, '');

        try {
          // Convert buffer to base64 (browser-compatible)
          let base64Content;

          if (attachment.content.type === 'Buffer' && Array.isArray(attachment.content.data)) {
            // MongoDB Buffer format: { type: 'Buffer', data: [array of bytes] }
            base64Content = arrayBufferToBase64(attachment.content.data);
          } else if (typeof attachment.content === 'string') {
            // Already base64 string
            base64Content = attachment.content;
          } else if (attachment.content instanceof ArrayBuffer) {
            // ArrayBuffer
            base64Content = arrayBufferToBase64(attachment.content);
          } else if (attachment.content instanceof Uint8Array) {
            // Uint8Array
            base64Content = arrayBufferToBase64(attachment.content);
          }

          if (base64Content) {
            const dataUrl = `data:${attachment.contentType || 'image/png'};base64,${base64Content}`;

            // Replace all occurrences of cid: references
            const cidPattern = new RegExp(`cid:${cid}`, 'gi');
            processedHtml = processedHtml.replace(cidPattern, dataUrl);
          }
        } catch (error) {
          console.error('Error processing CID image:', error);
        }
      }
    });

    return processedHtml;
  };

  const handleEmailClick = async (id) => {
    try {
      // ⚡ INSTANT FEEDBACK: Set loading immediately
      setLoadingEmailContent(true);
      setEmailFetchError(null);
      setFailedEmailId(null);

      // ⚡ CHECK CACHE FIRST (instant)
      if (emailCache[id]) {
        setSelectedEmail(emailCache[id]);
        setLoadingEmailContent(false);
        return;
      }

      // ⚡ SHOW IMMEDIATELY with metadata only (instant visual feedback)
      const emailFromList = filteredEmails.find(e => e._id === id);
      if (emailFromList) {
        setSelectedEmail(emailFromList);
      }
      
      // Fetch with retry logic - try up to 5 times with increasing delays
      let lastError = null;
      let successfulAttempt = false;

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const timeout = 5000 + (attempt * 2000); // 5s, 7s, 9s, 11s, 13s timeouts (increased for reliability)
          const response = await Promise.race([
            emailAPI.getEmailById(id),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`timeout after ${timeout}ms`)), timeout)
            )
          ]);

          const email = response.data.email;

          // Check if we got actual content
          if (email.body?.html || email.body?.text) {
            // Process inline images
            if (email.body?.html && email.attachments) {
              email.body.html = processCIDImages(email.body.html, email.attachments);
            }

            // Cache and update display
            setEmailCache(prev => ({ ...prev, [id]: email }));
            setSelectedEmail(email);
            successfulAttempt = true;
            break; // Success!
          } else if (attempt < 4) {
            // Body still loading, wait before retry (longer waits for background fetch)
            console.log(`Attempt ${attempt + 1}: Body still syncing, retrying in ${1000 + (attempt * 500)}ms...`);
            await new Promise(resolve => setTimeout(resolve, 1000 + (attempt * 500))); // 1s, 1.5s, 2s, 2.5s waits
          }
        } catch (err) {
          lastError = err;
          if (attempt < 4) {
            // Retry with longer waits
            console.log(`Attempt ${attempt + 1} failed: ${err.message}, retrying in ${1000 + (attempt * 500)}ms...`);
            await new Promise(resolve => setTimeout(resolve, 1000 + (attempt * 500))); // 1s, 1.5s, 2s, 2.5s waits
          }
        }
      }

      // After all retries
      if (successfulAttempt) {
        setLoadingEmailContent(false);
        return;
      }

      // All attempts failed - but don't show error if we have metadata
      if (emailFromList && emailFromList.subject) {
        // User can still see the email metadata, just no body
        // Body is still syncing - show helpful message
        console.log('Body still syncing, showing metadata with retry button');
        setEmailFetchError(false);
      } else {
        // No metadata either - show error
        console.error('Email load completely failed:', lastError?.message);
        setFailedEmailId(id);
        setEmailFetchError(true);
      }
    } catch (error) {
      console.error("Error in handleEmailClick:", error);
      setFailedEmailId(id);
      setEmailFetchError(true);
    } finally {
      setLoadingEmailContent(false);
    }
  };

  const handleDeleteEmail = async (id) => {
    if (!window.confirm("Delete this email?")) return;
    await emailAPI.deleteEmail(id);
    setSelectedEmail(null);
    // Clear from cache
    setEmailCache(prev => {
      const newCache = { ...prev };
      delete newCache[id];
      return newCache;
    });
    fetchEmails();
  };

  const handleDownloadAttachment = async (id, i, filename) => {
    try {
      const response = await emailAPI.downloadAttachment(id, i);
      const url = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading attachment:", error);
      alert(`Failed to download ${filename}: ${error.response?.data?.message || error.message}`);
    }
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // Extract domain from email address
  const extractDomain = (email) => {
    if (!email) return null;
    const match = email.match(/@(.+)$/);
    return match ? match[1].toLowerCase() : null;
  };

  const applyFilter = (type) => {
    let list = [...emails];
    if (type === "recent") list = list.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (type === "attachments") list = list.filter((e) => e.hasAttachments || e.attachments?.length > 0);
    setFilteredEmails(list);
    
    // Prefetch bodies for visible emails in parallel (first 3 only)
    setTimeout(() => {
      const toPreload = list.slice(0, 3);
      prefetchEmailBodiesParallel(toPreload);
    }, 50);
  };

  const loadMoreEmails = async () => {
    const nextPage = currentPage + 1;
    if (nextPage >= totalPages) return; // No more pages to load
    
    setLoadingMore(true);
    await fetchEmails(true, nextPage);
    setCurrentPage(nextPage);
  };

  const generateJobId = () => "JOB-" + Math.floor(100000 + Math.random() * 900000);

  const handleOpenTicketModal = () => {
    // If any emails are selected via checkboxes, use bulk create flow
    if (selectedEmails.length > 0) {
      setShowBulkCreateModal(true);
      return;
    }

    // Otherwise use the old single ticket modal for the currently viewed email
    if (!selectedEmail) return;
    const now = new Date();
    setTicketData({
      jobId: generateJobId(),
      consultantName: "Default Consultant",
      clientName: selectedEmail.from.name || selectedEmail.from.address,
      clientEmail: selectedEmail.from.address,
      createdDate: now.toISOString(),
      createdBy: "System User",
      subject: selectedEmail.subject,
      message: selectedEmail.body?.text || "",
      sourceEmailId: selectedEmail._id,
      attachments: selectedEmail.attachments || [],
    });
    setShowTicketModal(true);
  };

const handleCreateTicket = async () => {
  try {
    const res = await fetch('http://localhost:5000/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticketData),
    });

    const data = await res.json();
    if (res.ok) {
      alert('Ticket created and saved in DB!');
      setShowTicketModal(false);
      setSelectedEmails([]); // Clear selected emails after creating ticket
      await fetchEmails(true); // Refresh email list
    } else {
      alert('Failed to create ticket: ' + data.message);
    }
  } catch (err) {
    console.error(err);
    alert('Error creating ticket');
  }
};

  // Toggle email selection
  const toggleEmailSelection = (emailId) => {
    setSelectedEmails(prev => {
      if (prev.includes(emailId)) {
        return prev.filter(id => id !== emailId);
      } else {
        return [...prev, emailId];
      }
    });
  };

  // Fetch existing tickets filtered by domain
  const fetchExistingTickets = async (filterDomain = null) => {
    try {
      setLoadingTickets(true);
      const response = await fetch('http://localhost:5000/api/tickets', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      let tickets = data.tickets || [];

      // Filter tickets by domain if provided
      if (filterDomain) {
        tickets = tickets.filter(ticket => {
          const ticketDomain = extractDomain(ticket.clientEmail);
          return ticketDomain === filterDomain;
        });
      }

      setExistingTickets(tickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      alert('Failed to load tickets');
    } finally {
      setLoadingTickets(false);
    }
  };

  // Handle "Add to existing Ticket" button click
  const handleAddToExistingTicket = async () => {
    if (selectedEmails.length === 0) {
      alert('Please select at least one email');
      return;
    }

    // Extract domain from the first selected email
    const firstSelectedEmail = emails.find(e => selectedEmails.includes(e._id));
    const emailDomain = firstSelectedEmail ? extractDomain(firstSelectedEmail.from.address) : null;

    // Fetch tickets filtered by domain
    await fetchExistingTickets(emailDomain);
    setShowExistingTicketModal(true);
  };

  // Attach emails to selected ticket
  const handleAttachToTicket = async (ticketId) => {
    try {
      const emailsToAttach = emails.filter(e => selectedEmails.includes(e._id));

      const response = await fetch(`http://localhost:5000/api/tickets/${ticketId}/attach-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ emails: emailsToAttach })
      });

      if (response.ok) {
        alert(`Successfully attached ${selectedEmails.length} email(s) to ticket`);
        setSelectedEmails([]);
        setShowExistingTicketModal(false);

        // Refresh email list to update counts and remove attached emails
        await fetchEmails(true);
      } else {
        const data = await response.json();
        alert('Failed to attach emails: ' + data.message);
      }
    } catch (error) {
      console.error('Error attaching emails:', error);
      alert('Error attaching emails to ticket');
    }
  };

  // Create multiple tickets from selected emails
  const handleCreateMultipleTickets = async () => {
    try {
      setCreatingTickets(true);

      // Send only email IDs, not full email objects (to avoid serialization issues with Buffers)
      const emailIds = selectedEmails.map(id => ({ _id: id }));

      const response = await fetch('http://localhost:5000/api/tickets/bulk-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ emails: emailIds })
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Successfully created ${data.successCount} ticket(s)!${data.errorCount > 0 ? ` ${data.errorCount} failed.` : ''}`);
        setSelectedEmails([]);
        setShowBulkCreateModal(false);

        // Refresh email list
        await fetchEmails(true);
      } else {
        alert('Failed to create tickets: ' + data.message);
      }
    } catch (error) {
      console.error('Error creating tickets:', error);
      alert('Error creating tickets');
    } finally {
      setCreatingTickets(false);
    }
  };

  return (
    <div className="h-full w-full flex bg-[#F8F9FC] text-gray-800">
      {/* SIDEBAR */}
      <div className="w-[330px] border-r bg-white border-gray-200">
        {/* Header */}
        <div className="p-4 border-b flex flex-col gap-2 sticky top-0 z-20 border-gray-200 bg-white">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">⭐ Starred</h2>
              <button
                onClick={() => { setSyncing(true); syncEmails(false).finally(() => setSyncing(false)); }}
                disabled={syncing}
                className="px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded disabled:opacity-50"
                title="Sync emails from Gmail"
              >
                {syncing ? '⟳' : '↻'} Sync
              </button>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
              {emails.length}
            </span>
          </div>
          {/* Last sync indicator */}
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            {isBackgroundSync && (
              <span className="flex items-center gap-1 text-blue-600">
                <span className="animate-spin">⟳</span> Syncing...
              </span>
            )}
            {lastSyncTime && !isBackgroundSync && (
              <span>
                Last synced: {new Date(lastSyncTime).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </span>
            )}
            {!lastSyncTime && !isBackgroundSync && (
              <span className="text-gray-400">Auto-sync enabled (every 10s)</span>
            )}
          </div>
        </div>

        {/* FILTERS */}
        <div className="p-3 flex gap-2 border-b overflow-x-auto border-gray-200 bg-gray-50">
          {["all", "recent", "attachments"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs border ${filter === f ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-300 text-gray-600"}`}>{f}</button>
          ))}
        </div>

        {/* EMAIL LIST */}
        <div className="overflow-y-auto h-full">
          {filteredEmails.length === 0 ? (
            <div className="p-4 text-center text-sm opacity-70">
              {loading ? (
                <div>
                  <div className="animate-pulse mb-2">📧</div>
                  <div>Loading emails...</div>
                </div>
              ) : (
                <div>
                  <div className="mb-2">✅</div>
                  <div className="font-semibold">All emails converted to tickets!</div>
                  <div className="text-xs mt-2 opacity-60">
                    Starred emails automatically create tickets<br/>with "not_assigned" status
                  </div>
                </div>
              )}
            </div>
          ) :
              filteredEmails.map((email) => {
                const active = selectedEmail?._id === email._id;
                const isSelected = selectedEmails.includes(email._id);
                return (
                  <div key={email._id} className={`px-4 py-3 border-b flex gap-3 ${active ? "bg-blue-50 border-blue-500" : "border-gray-200 hover:bg-gray-50"} ${isSelected ? "bg-blue-100" : ""}`}>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEmailSelection(email._id);
                      }}
                      className="flex items-start pt-1"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEmailClick(email._id);
                      }}
                    >
                      <div className="flex justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-medium text-sm truncate">{email.from.name || email.from.address}</span>
                          {(email.hasAttachments || email.attachments?.length > 0) && (
                            <span className="text-xs" title="Has attachments">📎</span>
                          )}
                        </div>
                        <span className="text-[11px] opacity-70">{formatDate(email.date)}</span>
                      </div>
                      <p className="text-xs mt-0.5 truncate opacity-90">{email.subject}</p>
                      <p className="text-[11px] opacity-60 truncate">{email.body?.text?.slice(0, 70) || email.body?.html?.replace(/<[^>]*>/g, '').slice(0, 70) || "(No content)"}</p>
                    </div>
                  </div>
                );
              })
          }
          
          {/* Load More Button */}
          {currentPage < totalPages - 1 && (
            <div className="p-4 border-t border-gray-200 text-center">
              <button
                onClick={loadMoreEmails}
                disabled={loadingMore}
                className="px-4 py-2 text-sm rounded-md bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 disabled:opacity-50"
              >
                {loadingMore ? '⟳ Loading...' : `Load More (${totalEmails - emails.length} remaining)`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL - Gmail-like Design */}
      <div className="flex-1 overflow-y-auto bg-white">
        {!selectedEmail ? (
          <div className="flex items-center justify-center h-full opacity-70">
            <div className="text-center">
              <div className="text-6xl mb-3">📭</div>
              <p className="text-sm text-gray-600">Select an email to view</p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {/* Gmail-like Header with Actions */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-3 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    title="Back to inbox"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenTicketModal}
                    className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                  >
                    Create Ticket{selectedEmails.length > 1 ? 's' : ''} {selectedEmails.length > 0 && `(${selectedEmails.length})`}
                  </button>
                  <button
                    onClick={handleAddToExistingTicket}
                    className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
                  >
                    Add to Ticket
                  </button>
                  <button
                    onClick={() => handleDeleteEmail(selectedEmail._id)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    title="Delete"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Email Content */}
            <div className="px-6 py-6">
              {/* Subject */}
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-normal text-gray-900 flex-1">
                    {selectedEmail.subject || "(No Subject)"}
                  </h1>
                  {loadingEmailContent && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full text-xs text-blue-700 font-medium">
                      <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading content...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Email Header Card - Gmail Style */}
              <div className="mb-6">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {(selectedEmail.from.name || selectedEmail.from.address).charAt(0).toUpperCase()}
                  </div>

                  {/* Sender Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <div>
                        <span className="font-medium text-sm text-gray-900">
                          {selectedEmail.from.name || selectedEmail.from.address}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          &lt;{selectedEmail.from.address}&gt;
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                        {new Date(selectedEmail.date).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>

                    {/* To/CC Recipients */}
                    <div className="text-xs text-gray-600">
                      {selectedEmail.to && selectedEmail.to.length > 0 && (
                        <div className="mb-1">
                          to {selectedEmail.to.map(t => t.name || t.address).join(', ')}
                        </div>
                      )}
                      {selectedEmail.cc && selectedEmail.cc.length > 0 && (
                        <div className="text-gray-500">
                          cc {selectedEmail.cc.map(c => c.name || c.address).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Attachments - Gmail Style */}
              {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-xs text-gray-600 font-medium">
                      {selectedEmail.attachments.length} Attachment{selectedEmail.attachments.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedEmail.attachments.map((a, i) => {
                      const fileExt = a.filename?.split('.').pop()?.toLowerCase() || '';
                      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt);
                      const isPdf = fileExt === 'pdf';
                      const isDoc = ['doc', 'docx'].includes(fileExt);
                      const isXls = ['xls', 'xlsx'].includes(fileExt);

                      return (
                        <button
                          key={i}
                          onClick={() => handleDownloadAttachment(selectedEmail._id, i, a.filename)}
                          className="flex items-center gap-2 px-3 py-2 border border-gray-300 bg-white rounded hover:bg-gray-50 hover:border-gray-400 transition-colors group"
                          title={`Download ${a.filename}`}
                        >
                          {/* File Icon */}
                          <div className="flex items-center justify-center">
                            {isImage ? (
                              <span className="text-base">🖼️</span>
                            ) : isPdf ? (
                              <span className="text-base">📄</span>
                            ) : isDoc ? (
                              <span className="text-base">📝</span>
                            ) : isXls ? (
                              <span className="text-base">📊</span>
                            ) : (
                              <span className="text-base">📎</span>
                            )}
                          </div>

                          {/* File Info */}
                          <div className="text-left">
                            <div className="text-xs font-medium text-gray-900 max-w-[180px] truncate">
                              {a.filename}
                            </div>
                            {a.size && (
                              <div className="text-[10px] text-gray-500">
                                {(a.size / 1024).toFixed(1)} KB
                              </div>
                            )}
                          </div>

                          {/* Download Icon */}
                          <svg className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Show message if email should have attachments but they're not loaded */}
              {selectedEmail.hasAttachments && (!selectedEmail.attachments || selectedEmail.attachments.length === 0) && (
                <div className="mb-6 p-4 border border-yellow-300 rounded-lg bg-yellow-50">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-sm">This email has attachments but they're still loading...</span>
                  </div>
                </div>
              )}

              {/* Email Body - Gmail Style Wrapper */}
              <div className="mt-6">
                {loadingEmailContent && !selectedEmail.body?.html ? (
                  <div className="gmail-email-wrapper">
                    {/* Loading Skeleton */}
                    <div className="space-y-4 animate-pulse">
                      <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                      <div className="space-y-3">
                        <div className="h-4 bg-gray-100 rounded"></div>
                        <div className="h-4 bg-gray-100 rounded w-5/6"></div>
                        <div className="h-4 bg-gray-100 rounded w-4/6"></div>
                      </div>
                      <div className="space-y-3 mt-6">
                        <div className="h-4 bg-gray-100 rounded"></div>
                        <div className="h-4 bg-gray-100 rounded"></div>
                        <div className="h-4 bg-gray-100 rounded w-5/6"></div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-6 text-center">⟳ Loading message content...</p>
                  </div>
                ) : selectedEmail.body?.html ? (
                  <div className="gmail-email-wrapper">
                    <div
                      className="email-content gmail-style"
                      dangerouslySetInnerHTML={{ __html: selectedEmail.body.html }}
                    />
                  </div>
                ) : selectedEmail.body?.text ? (
                  <div className="gmail-email-wrapper">
                    <div className="email-content gmail-style gmail-plaintext">
                      {(() => {
                        const text = selectedEmail.body.text;
                        // Split by common signature patterns
                        const signaturePatterns = [
                          /\n\n[-–—]+\n/,  // Separator lines
                          /\n\n--\s*\n/,   // Double dash separator
                          /\[.*?EmailSignature.*?\]/i, // Email signature tags
                          /\n\n(Best regards|Best|Regards|Thanks|Thank you|Sincerely|Cheers),?\n/i,
                        ];

                        let mainContent = text;
                        let signature = '';

                        // Try to find signature
                        for (const pattern of signaturePatterns) {
                          const match = text.match(pattern);
                          if (match) {
                            const splitIndex = match.index + match[0].length;
                            mainContent = text.substring(0, match.index);
                            signature = text.substring(match.index);
                            break;
                          }
                        }

                        // If no pattern found but text has common signature markers, try splitting
                        if (!signature && (text.includes('[') && text.includes('EmailSignature'))) {
                          const sigStart = text.indexOf('[');
                          if (sigStart > 0) {
                            mainContent = text.substring(0, sigStart).trim();
                            signature = text.substring(sigStart);
                          }
                        }

                        return (
                          <>
                            {/* Main message */}
                            <div style={{
                              fontFamily: 'Arial, sans-serif',
                              fontSize: '14px',
                              lineHeight: '1.7',
                              color: '#222222',
                              whiteSpace: 'pre-wrap',
                              wordWrap: 'break-word',
                              marginBottom: signature ? '24px' : '0'
                            }}>
                              {mainContent.trim()}
                            </div>

                            {/* Signature */}
                            {signature && (
                              <div style={{
                                borderTop: '1px solid #e8eaed',
                                paddingTop: '16px',
                                marginTop: '16px',
                                fontFamily: 'Arial, sans-serif',
                                fontSize: '13px',
                                lineHeight: '1.6',
                                color: '#5f6368',
                                whiteSpace: 'pre-wrap',
                                wordWrap: 'break-word'
                              }}>
                                {signature.trim()}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <div className="text-gray-500">
                        <p className="text-sm font-medium">Email content is syncing...</p>
                        <p className="text-xs mt-2 text-gray-400">This usually takes less than 10 seconds</p>
                        <div className="mt-4 flex gap-2 justify-center">
                          <button
                            onClick={() => handleEmailClick(selectedEmail._id)}
                            className="px-4 py-2 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          >
                            ⟳ Retry
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* EMAIL FETCH ERROR MODAL */}
      {emailFetchError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-red-50 border-b border-red-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-red-900">Failed to fetch email</h3>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              <p className="text-gray-700 mb-4">
                The email may have been deleted or moved in Gmail.
              </p>

              {/* Troubleshooting Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Troubleshooting:
                </h4>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold flex-shrink-0">•</span>
                    <span>Email content may still be syncing from Gmail</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold flex-shrink-0">•</span>
                    <span>Click <strong>Sync</strong> to trigger immediate sync, then <strong>Retry</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-600 font-bold flex-shrink-0">•</span>
                    <span>Auto-sync runs every 15 seconds automatically</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-gray-50 border-t px-6 py-4 flex gap-3">
              <button
                onClick={() => {
                  setEmailFetchError(false);
                  setSelectedEmail(null);
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Close
              </button>
              <button
                onClick={async () => {
                  // Sync emails first, then retry
                  await syncEmails(true);
                  setTimeout(() => handleEmailClick(failedEmailId), 1000);
                }}
                className="flex-1 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Sync &amp; Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TICKET MODAL */}
      {showTicketModal && <CreateTicketModal ticketData={ticketData} setTicketData={setTicketData} onClose={() => setShowTicketModal(false)} onCreate={handleCreateTicket} />}

      {/* EXISTING TICKET MODAL */}
      {showExistingTicketModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-bold">Select Ticket to Add Emails</h2>
              <button
                onClick={() => setShowExistingTicketModal(false)}
                className="text-gray-500 hover:text-gray-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-blue-50 border-b">
              <p className="text-sm text-blue-800">
                <strong>{selectedEmails.length}</strong> email(s) selected. Click on a ticket below to attach them.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingTickets ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading tickets...</p>
                </div>
              ) : existingTickets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No tickets found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {existingTickets.map((ticket) => (
                    <div
                      key={ticket._id}
                      onClick={() => handleAttachToTicket(ticket._id)}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-blue-600 text-sm">{ticket.jobId}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              ticket.status === 'completed' ? 'bg-green-100 text-green-700' :
                              ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {ticket.status}
                            </span>
                          </div>
                          <p className="text-sm mt-1 text-gray-700">
                            <strong>Client:</strong> {ticket.clientName || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            <strong>Consultant:</strong> {ticket.consultantName || 'N/A'}
                          </p>
                          {ticket.emails && ticket.emails.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              📧 {ticket.emails.length} email(s) already attached
                            </p>
                          )}
                        </div>
                        <button className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 transition-colors">
                          Add Emails
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowExistingTicketModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md text-sm font-semibold hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK CREATE TICKETS MODAL */}
      {showBulkCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b bg-green-50">
              <h2 className="text-lg font-bold text-green-800">
                Create {selectedEmails.length === 1 ? 'Ticket' : 'Multiple Tickets'}
              </h2>
              <button
                onClick={() => setShowBulkCreateModal(false)}
                className="text-gray-500 hover:text-gray-700 text-xl font-bold"
                disabled={creatingTickets}
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4 text-center">
                <div className="text-5xl mb-3">✨</div>
                <p className="text-gray-700 mb-2">
                  You are about to create <strong className="text-green-600 text-xl">{selectedEmails.length}</strong> new ticket{selectedEmails.length > 1 ? 's' : ''}
                </p>
                <p className="text-sm text-gray-500">
                  {selectedEmails.length === 1
                    ? 'This email will become a ticket with a unique Job ID'
                    : 'Each selected email will become a separate ticket with a unique Job ID'}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <h3 className="text-xs font-semibold text-gray-600 mb-2 uppercase">Selected Emails:</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {emails.filter(e => selectedEmails.includes(e._id)).map((email, idx) => (
                    <div key={email._id} className="text-xs text-gray-700 flex gap-2">
                      <span className="text-gray-400">{idx + 1}.</span>
                      <span className="flex-1 truncate">
                        <strong>{email.from.name || email.from.address}</strong>: {email.subject}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> Each ticket will be created with status "Not Assigned" and can be assigned later from the dashboard.
                </p>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
              <button
                onClick={() => setShowBulkCreateModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md text-sm font-semibold hover:bg-gray-300 disabled:opacity-50"
                disabled={creatingTickets}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMultipleTickets}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                disabled={creatingTickets}
              >
                {creatingTickets ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    ✨ Create {selectedEmails.length} Ticket{selectedEmails.length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Mail;
