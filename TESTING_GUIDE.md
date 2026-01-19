# Data Persistence Testing Guide

## Problem
After filling in fields (Client Type, To Check, Team Member, etc.) and refreshing the page, the data becomes blank.

## Root Cause
The Ticket schema was missing fields for:
- Multiple team members (array)
- Multiple client types (array)
- Multiple "to check" names (array)
- New/Edits fields

## Fix Applied
Updated `server/models/Ticket.js` to support these fields properly.

---

## CRITICAL: Steps to Fix (Do These First!)

### Step 1: Stop the Server
```bash
# Press Ctrl+C in the terminal where server is running
```

### Step 2: Restart the Server
```bash
cd server
node server.js
# or
npm start
```

**⚠️ IMPORTANT:** Schema changes require server restart!

### Step 3: Clear Browser Cache
- Press `Ctrl + Shift + Delete`
- Select "Cached images and files"
- Click "Clear data"
- OR just do a hard refresh: `Ctrl + Shift + R`

---

## Testing Procedure

### Open Browser Developer Tools
1. Press `F12` to open DevTools
2. Go to **Console** tab
3. Keep it open while testing

### Test Each Field Type

#### Test 1: Client Type (Multi-Select)
1. Find a job row
2. Click on "Add" under Client Type column
3. Select "New Client"
   - ✅ You should see toast: "Added client type: New Client"
   - ✅ Console should show: `🏷️ Adding client type "New Client"...`
   - ✅ Console should show: `💾 Saving ticket...`
   - ✅ Console should show: `✅ Ticket saved successfully`
4. Add another type "Level 1"
5. **Refresh page (F5)**
6. ✅ Both "New Client" and "Level 1" should still be there

#### Test 2: To Check (Multi-Select)
1. Click on "Add" under To Check column
2. Select "Malar"
   - ✅ Toast: "Added to check: Malar"
   - ✅ Console: `✅ Adding to check "Malar"...`
3. Add "Ravi"
4. **Refresh page (F5)**
5. ✅ Both "Malar" and "Ravi" should still be there

#### Test 3: Team Member (Multi-Select)
1. Click on "Add" under Team Member column
2. Select a team member
   - ✅ Toast: "Added [name] to the team"
   - ✅ Console: `👤 Adding team member...`
3. Add another team member
4. **Refresh page (F5)**
5. ✅ All team members should still be there

#### Test 4: Text Fields (New/Edits)
1. Type "5" in the "New" field
   - ✅ After 500ms, console should show: `💾 Saving ticket...`
   - ✅ See "Saving..." indicator on row
   - ✅ See "Saved" indicator after success
2. Type "3" in the "Edits" field
3. **Refresh page (F5)**
4. ✅ Values "5" and "3" should still be there

#### Test 5: Estimate Time
1. Select hours: "3h"
2. Select minutes: "30m"
   - ✅ Console shows save operations
3. **Refresh page (F5)**
4. ✅ "3h 30m" should still be there

#### Test 6: Deadline
1. Click on deadline field
2. Select a date and time
   - ✅ Console shows save operation
3. **Refresh page (F5)**
4. ✅ Deadline should still be there

---

## What to Look For in Console

### ✅ Good Signs (Everything Working)
```
📥 Fetching tickets from API...
✅ Fetched tickets: 4 tickets
📊 Sample ticket data: {jobId: "JOB-740354", meta: {...}, ...}
🏷️ Adding client type "New Client" to ticket 123...
💾 Saving ticket 123: {meta: {clientType: ["New Client"]}}
✅ Ticket 123 saved successfully: {message: "Ticket updated", ticket: {...}}
```

### ❌ Bad Signs (Something Wrong)
```
❌ Error saving ticket 123: ...
❌ Error loading tickets: ...
⚠️ Unable to fully rollback meta changes
```

---

## Troubleshooting

### If Data Still Doesn't Persist:

#### 1. Check Server Logs
Look in the server terminal for errors:
```
Error: ...
```

#### 2. Check Database Connection
Server should show on startup:
```
✅ MongoDB connected successfully
Server running on port 5000
```

#### 3. Verify API Calls
In browser DevTools → Network tab:
- Look for `PUT /api/tickets/[id]` requests
- Check if they return `200 OK`
- Check response body has `{message: "Ticket updated"}`

#### 4. Check for CORS Errors
If you see CORS errors in console, the frontend can't talk to backend.

#### 5. Verify Schema Update
In MongoDB, check a ticket document:
```javascript
{
  assignedInfo: {
    teamMembers: [],  // ✅ Should exist
    teamLeads: []     // ✅ Should exist
  },
  meta: {
    clientType: [],   // ✅ Can be array now
    toCheck: [],      // ✅ Can be array now
    new: "",          // ✅ Should exist
    edits: ""         // ✅ Should exist
  }
}
```

---

## Expected Console Output (Complete Flow)

### On Page Load:
```
📥 Fetching tickets from API...
✅ Fetched tickets: 4 tickets
📊 Sample ticket data: {
  _id: "...",
  jobId: "JOB-740354",
  clientName: "Kunal Parulekar",
  assignedInfo: {
    teamMembers: ["John", "Jane"],
    teamLeads: ["TeamLead1"]
  },
  meta: {
    clientType: ["New Client", "Level 1"],
    toCheck: ["Malar", "Ravi"],
    new: "5",
    edits: "3"
  }
}
```

### When Adding Client Type:
```
🏷️ Adding client type "New Client" to ticket abc123. New types: ["New Client"]
💾 Saving ticket abc123: {meta: {clientType: ["New Client"], ...}}
✅ Ticket abc123 saved successfully: {...}
```

### When Adding Team Member:
```
👤 Adding team member John to ticket abc123: {assignedInfo: {...}}
✅ Team member John added successfully: {...}
```

---

## Quick Test Checklist

- [ ] Server restarted after schema change
- [ ] Browser cache cleared / hard refresh
- [ ] Console shows "Fetched tickets" on page load
- [ ] Adding client type shows save logs
- [ ] Adding team member shows save logs
- [ ] Typing in New/Edits shows "Saving..." indicator
- [ ] All fields persist after page refresh
- [ ] No red errors in console
- [ ] Save status indicator shows "Saved" (green checkmark)

---

## If Everything Fails

1. **Backup your data** (export from MongoDB)
2. **Drop and recreate** the tickets collection:
   ```javascript
   // In MongoDB shell or Compass
   db.tickets.drop()
   ```
3. **Restart server**
4. **Recreate test tickets**

Or contact support with:
- Server logs
- Browser console logs
- Network tab screenshot
- MongoDB ticket document example
