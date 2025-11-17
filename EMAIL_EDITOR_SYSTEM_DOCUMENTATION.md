# Email Editor System - Complete Documentation

## ✅ NEW TAB SYSTEM IMPLEMENTED

The email preview modal now has **TWO TABS** for professional email management:

### 📧 Tab 1: "Podgląd Emaila" (Email Preview)
- **What it shows**: Rendered HTML email exactly as the client will see it
- **Features**:
  - Beautiful styled email with your branding
  - Real-time preview of all changes
  - Professional layout with sections for Google Ads and Meta Ads
  - Responsive design that works on all devices

### 💻 Tab 2: "Edytor HTML" (HTML Editor)
- **What it shows**: Raw HTML code that will be sent
- **Features**:
  - Full HTML editing capabilities
  - Syntax highlighting (dark theme with green text)
  - Warning notice: "UWAGA: To jest rzeczywisty kod HTML, który zostanie wysłany do klienta"
  - Complete control over email content and styling

---

## 🔒 GUARANTEE: THIS IS THE REAL EMAIL SYSTEM

### How It Works:

1. **Edit the Email**
   - Switch to "Edytor HTML" tab
   - Modify the HTML code
   - See changes in "Podgląd Emaila" tab

2. **Save Changes**
   - Click "✅ Zapisz i użyj tego emaila" button
   - System saves BOTH:
     - `text_template`: Plain text version
     - `html_template`: HTML version (this is what gets sent!)

3. **Email Sending**
   - When the scheduled time arrives, the system calls `FlexibleEmailService.sendClientMonthlyReport()`
   - The service checks for saved drafts for this client
   - If draft exists: **USES YOUR EDITED HTML**
   - If no draft: Uses default template

### Code Flow:

```typescript
// 1. User edits HTML in modal
setEditableHtml(newHTML);

// 2. User saves
await saveDraft(); 
// → Saves to: draftData.html_template = editableHtml

// 3. Scheduled email time
emailService.sendClientMonthlyReport(...);
// → Loads draft from database
// → Uses draft.html_template (YOUR EDITED VERSION)
// → Sends via Resend or Gmail
```

---

## 🎨 HTML Template Structure

The generated HTML includes:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Podsumowanie miesiąca - [month] [year] | [Client]</title>
  <style>
    /* Professional email styles */
    body { font-family: -apple-system, ... }
    .container { background: white; padding: 30px; }
    .section-title { border-bottom: 2px solid #3b82f6; }
    .metrics { background: #f8f9fa; padding: 15px; }
    .summary { background: #e3f2fd; }
    /* ... more styles */
  </style>
</head>
<body>
  <div class="container">
    <!-- Greeting -->
    <div class="greeting">Dzień dobry,</div>
    
    <!-- Introduction -->
    <p>poniżej przesyłam podsumowanie...</p>
    
    <!-- Dashboard Link -->
    <p><a href="...">TUTAJ</a></p>
    
    <!-- Google Ads Section -->
    <div class="section">
      <div class="section-title">1. Google Ads</div>
      <div class="metrics">
        <div class="metric-line">...</div>
      </div>
    </div>
    
    <!-- Meta Ads Section -->
    <div class="section">
      <div class="section-title">2. Meta Ads</div>
      <div class="metrics">...</div>
    </div>
    
    <!-- Summary -->
    <div class="summary">
      <strong>Podsumowanie ogólne</strong><br><br>
      [Micro conversions calculation]
      [20% offline estimation]
      [Total value]
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p>W razie pytań proszę o kontakt.</p>
      <p>Pozdrawiam<br><strong>Piotr</strong></p>
    </div>
  </div>
</body>
</html>
```

---

## 🔧 Key Features

### 1. **Real Data Integration**
- ✅ Fetches from BOTH `campaigns` (Meta) and `google_ads_campaigns` (Google)
- ✅ Calculates all metrics in real-time
- ✅ Formats numbers in Polish (1 234,56 format)
- ✅ Shows proper month names in Polish

### 2. **Dynamic Per Client**
- ✅ Each client gets their own data
- ✅ Date range specific to schedule
- ✅ Personalized with client name
- ✅ Correct calculations for their campaigns

### 3. **Professional Design**
- ✅ Responsive layout
- ✅ Clean, modern styling
- ✅ Easy to read sections
- ✅ Highlighted summary box
- ✅ Professional footer

### 4. **Editing Safety**
- ✅ Warning notice in HTML editor
- ✅ Preview before sending
- ✅ "Przywróć oryginał" to reset
- ✅ Clear confirmation message

---

## 📝 Usage Instructions

### For Preview:
1. Go to `/admin/calendar`
2. Click "Podgląd Email" on any scheduled report
3. Click "Podgląd Emaila" tab
4. See exactly how the email will look

### For Editing:
1. Click "Edytor HTML" tab
2. Edit the HTML code
3. Switch back to "Podgląd Emaila" to see changes
4. Click "✅ Zapisz i użyj tego emaila" when satisfied

### For Testing:
1. Edit the email as needed
2. Save it
3. The system will use this version for that specific client
4. When the scheduled time comes, YOUR VERSION gets sent

---

## ⚠️ Important Notices

### Green Notice Box:
```
✅ Potwierdź: Ten email zostanie rzeczywiście wysłany do klienta podczas 
automatycznego wysyłania. Każda zmiana w zakładce "Edytor HTML" będzie 
użyta w prawdziwym emailu.
```

This appears at the bottom of the modal to confirm that:
- ✅ This is the REAL email system
- ✅ Changes will be ACTUALLY sent
- ✅ HTML edits are used in production

### Yellow Warning (in HTML Editor):
```
⚠️ UWAGA: To jest rzeczywisty kod HTML, który zostanie wysłany do klienta. 
Edytuj ostrożnie!
```

---

## 🔍 Verification

### How to Verify It's Real:

1. **Check Database**
   ```sql
   SELECT * FROM email_drafts 
   WHERE client_id = '[your-client-id]';
   ```
   You'll see `html_template` column with your edited HTML

2. **Check Email Logs**
   ```sql
   SELECT * FROM email_logs 
   WHERE client_id = '[your-client-id]' 
   ORDER BY sent_at DESC LIMIT 1;
   ```
   Shows actual emails sent

3. **Monitor Console**
   When email is sent, you'll see:
   ```
   📝 Using saved draft for email generation
   ✉️ Sending email to: client@example.com
   ✅ Email sent successfully
   ```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER OPENS CALENDAR                                      │
│    └→ Clicks "Podgląd Email"                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. SYSTEM FETCHES DATA                                      │
│    ├→ campaigns (Meta Ads)                                  │
│    ├→ google_ads_campaigns (Google Ads)                     │
│    └→ Calculates totals, ROAS, micro conversions            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. GENERATES EMAIL                                          │
│    ├→ Populates HTML template with real data                │
│    ├→ Formats Polish numbers and dates                      │
│    └→ Creates both text and HTML versions                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. USER SEES TWO TABS                                       │
│    ├→ Tab 1: Beautiful preview (rendered HTML)              │
│    └→ Tab 2: Raw HTML editor                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. USER EDITS (OPTIONAL)                                    │
│    ├→ Switches to HTML editor                               │
│    ├→ Modifies HTML code                                    │
│    └→ Previews changes                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. USER SAVES                                               │
│    ├→ Clicks "✅ Zapisz i użyj tego emaila"                 │
│    ├→ System saves to database                              │
│    └→ Confirmation: "Zmiany zapisane!"                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. SCHEDULED TIME ARRIVES                                   │
│    ├→ EmailScheduler runs                                   │
│    ├→ Loads SAVED HTML from database                        │
│    └→ Sends via FlexibleEmailService                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. CLIENT RECEIVES EMAIL                                    │
│    └→ YOUR EDITED HTML VERSION! ✅                          │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Final Confirmation

**YES, THIS IS THE REAL EMAIL SYSTEM!**

- ✅ Edited HTML is saved to database
- ✅ Saved HTML is used when sending
- ✅ No mock data or simulations
- ✅ Direct integration with email sending service
- ✅ Real emails sent to real clients

**Your edits WILL be sent to clients!**

---

Generated: 2025-11-17
Status: ✅ FULLY IMPLEMENTED AND TESTED

