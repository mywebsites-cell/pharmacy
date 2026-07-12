# 🚀 Quick Start Guide - Run & Test Admin Panel

## ⚡ 30-Second Setup

### **1. Start Backend (Mock Server)**
```powershell
cd "d:\webs\pharmacy app\backend"
node mock-server.js
```
✓ Runs on `http://localhost:8000`  
✓ Test data ready immediately  

### **2. Start Frontend** (New Terminal)
```powershell
cd "d:\webs\pharmacy app\frontend-web"
npm run dev
```
✓ Runs on `http://localhost:3000`

### **3. Open Admin Panel**
Go to: `http://localhost:3000/admin/subscriptions`

---

## 🎯 Test the Admin Panel

### **What You Should See:**
- ✅ Table with 2 payments (khan, buyer_final)
- ✅ User names and emails displaying correctly
- ✅ "View & Review" button on pending payment
- ✅ Green "Approved" badge on first payment
- ✅ Amber "Pending" badge on second payment

### **Test Approve Workflow:**

1. **Click "View & Review"** on buyer_final payment
   - Modal opens showing all payment details
   - See payment proof section
   - See notes: "Buying 1 dollar plan!"

2. **Click "Approve Payment"**
   - Subscription activates
   - Modal closes
   - Status changes from "Pending" to "Approved"
   - Payment removed from "View & Review" action

3. **Refresh Page** (Ctrl+F5)
   - Both payments now show as "Approved"
   - No more pending payments

### **Test Reject Workflow:**

1. **Click "View & Review"** on a pending payment

2. **Click "Reject Payment"**
   - Textarea appears asking for reason

3. **Enter Reason** (e.g., "Invalid payment receipt")

4. **Click "Confirm Rejection"**
   - Reason recorded
   - Status changes to "Rejected"
   - Red badge shows "Rejected"

---

## 📊 What Each Column Shows

| Column | What It Shows | Example |
|--------|---------------|---------|
| **Pharmacy / User** | Username and email | buyer_final / buyer@example.com |
| **Plan** | Subscription plan | Basic |
| **Amount Paid** | Payment amount (in green) | $1 |
| **Submitted** | When payment was sent | 6/22/2026 |
| **Status** | Current status badge | Pending / Approved / Rejected |
| **Actions** | Review button | View & Review (only for Pending) |

---

## 🔧 Backend Options

### **Option A: Quick Testing (Recommended)**
```powershell
node backend/mock-server.js
```
- ✅ No setup needed
- ✅ Instant test data
- ✅ Perfect for UI testing

### **Option B: Real Database (Production)**
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8001
```
- ✅ Real PostgreSQL database
- ✅ Data persists
- ✅ Production-ready

**Need help with Option B?** See `DATABASE_SETUP.md`

---

## 🗄️ Mock Server Test Data

The mock server includes these test users and payments:

### **Users:**
- Username: `khan` | Email: `khan@123`
- Username: `buyer_final` | Email: `buyer@example.com`

### **Payment Submissions:**
1. **khan** → test plan → $1 → **APPROVED** ✅
2. **buyer_final** → Basic plan → $1 → **PENDING** ⏳

Both have test notes and payment proofs attached.

---

## 🆘 Troubleshooting

### **Problem: "Can't connect to backend"**
```
✗ Error: GET localhost:8000/api/v1/admin/payment-submissions/
```
**Solution**: 
- Make sure `node mock-server.js` is running
- Check terminal shows "Mock server listening on port 8000"
- Try `http://localhost:8000/health` in browser

### **Problem: "No users showing in table (displays N/A)"**
**Solution**:
- Refresh page: `Ctrl+F5`
- Check browser console for errors: `F12 → Console`
- Restart backend: `Ctrl+C` then `node mock-server.js`

### **Problem: "Payment image not displaying"**
**Solution**:
- Image might not be uploaded with payment
- Click "View & Review" to fetch full details
- Check Network tab (`F12 → Network`) for API response
- Base64 string should start with `iVBORw0KGgo...` (for PNG)

### **Problem: "Port 8000 already in use"**
**Solution**:
```powershell
# Check what's using the port
netstat -ano | findstr :8000

# Kill the process
Stop-Process -Id <PID> -Force

# Or run on different port
node mock-server.js 9000
```

### **Problem: "Approve/Reject button not working"**
**Solution**:
- Ensure backend is running
- Check Network tab for API response
- Look for error messages in browser console
- Try refreshing page

---

## 📋 API Endpoints (For Reference)

```
GET  http://localhost:8000/api/v1/admin/users/
     → Returns all users

GET  http://localhost:8000/api/v1/admin/payment-submissions/
     → Returns all payments (without screenshots for performance)

GET  http://localhost:8000/api/v1/admin/payment-submissions/1/
     → Returns single payment WITH screenshot_base64

POST http://localhost:8000/api/v1/admin/payment-submissions/1/approve/
     → Approves payment, creates subscription

POST http://localhost:8000/api/v1/admin/payment-submissions/1/reject/
     Body: {"reason": "Invalid receipt"}
     → Rejects payment with reason
```

---

## ✨ Features Working

✅ **User Data Display**
- Username and email showing correctly
- No more "N/A" values

✅ **Payment Proof Display**
- Image displays in modal (if provided)
- Proper error handling
- Fallback text if no image

✅ **Approve Workflow**
- 1-click approval
- Subscription auto-activates
- Status updates immediately

✅ **Reject Workflow**
- Rejection reason capture
- Required reason validation
- Reason stored in database

✅ **Professional UI**
- Dark theme with good contrast
- Clear visual hierarchy
- Status badges with icons
- Responsive layout

---

## 🎓 How Data Flows

```
User Makes Payment
    ↓
Screenshot uploaded
    ↓
Data sent to Backend: /subscriptions/payment-submit/
    ↓
Stored in Database (or Mock Server)
    ↓
Admin sees in "Pending Approvals" tab
    ↓
Admin clicks "View & Review"
    ↓
Modal fetches full details from: /admin/payment-submissions/1/
    ↓
Modal shows all info + image
    ↓
Admin clicks "Approve"
    ↓
Backend creates subscription: /admin/payment-submissions/1/approve/
    ↓
Subscription activated for user
    ↓
User gets access to app
    ↓
Status changes to "Approved"
```

---

## 📖 Full Documentation

For detailed information, see:
- 📄 `DATABASE_SETUP.md` - Complete database & server guide
- 📄 `ADMIN_PANEL_GUIDE.md` - Detailed admin panel usage
- 📄 `SUBSCRIPTION_FLOW.txt` - Subscription workflow

---

## 🚀 Ready to Go!

Your admin panel is fully operational! 

**Start with**:
```powershell
node backend/mock-server.js  # Terminal 1
npm run dev -C frontend-web   # Terminal 2
```

Then open: `http://localhost:3000/admin/subscriptions`

Happy testing! 🎉

