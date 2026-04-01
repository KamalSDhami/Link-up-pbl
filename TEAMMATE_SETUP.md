# 🚀 Linkup - Setup Guide for Teammates

## Prerequisites
- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **Git** installed
- A code editor (VS Code recommended)

---

## 📥 Step 1: Clone the Repository

```bash
git clone https://github.com/KamalSDhami/Linkup.git
cd Linkup/frontend
```

---

## 🔧 Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages listed in `package.json`. It may take 2-3 minutes.

---

## 🔐 Step 3: Set Up Environment Variables

### **Important:** The `.env` file is NOT in the repo for security reasons!

1. Create a new file called `.env` in the `frontend/` folder
2. **Ask your team lead** (Kamal) for the environment variables via DM
3. Copy the values into your `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**Example of what it should look like:**
```env
VITE_SUPABASE_URL=https://jorhqtihmyjvktcrfzpf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **Never commit this file to Git!** It's already in `.gitignore`.

---

## ▶️ Step 4: Run the Development Server

```bash
npm run dev
```

You should see:
```
VITE v5.4.20  ready in XXX ms

➜  Local:   http://localhost:3000/
```

Open your browser to **http://localhost:3000/** (or the port shown)

---

## ✅ Step 5: Test It Works

1. Go to http://localhost:3000/
2. Click **"Sign Up"**
3. Create a test account with your email
4. Complete profile setup
5. You should see the dashboard! 🎉

---

## 🐛 Troubleshooting

### Problem: "Missing Supabase environment variables"
**Solution:** You forgot to create the `.env` file or it's empty. Ask team lead for credentials.

### Problem: "Port 3000 is in use"
**Solution:** That's fine! Vite will use port 3001 or 3002 automatically.

### Problem: Can't login or database errors
**Solution:** 
1. Check your `.env` file has correct values
2. Make sure there are no extra spaces or quotes
3. Ask team lead to verify the credentials

### Problem: TypeScript errors in VS Code
**Solution:** 
1. Press `Ctrl+Shift+P`
2. Type "TypeScript: Restart TS Server"
3. Press Enter

### Problem: "npm install" fails
**Solution:** 
1. Delete `node_modules/` folder
2. Delete `package-lock.json` file
3. Run `npm install` again

---

## 📚 Project Structure

```
frontend/
├── src/
│   ├── pages/          # All page components (organized by feature)
│   │   ├── auth/       # Login, Signup, etc.
│   │   ├── dashboard/  # Main dashboard
│   │   ├── profile/    # User profile
│   │   ├── teams/      # Teams section
│   │   └── ...
│   ├── components/     # Reusable components
│   │   └── layout/     # Navbar, Sidebar
│   ├── lib/           # Utilities (supabase client, etc.)
│   ├── store/         # State management (Zustand)
│   └── types/         # TypeScript types
├── public/            # Static assets
├── .env              # ⚠️ Your credentials (NOT in Git)
└── package.json      # Dependencies
```

---

## 🔄 Daily Workflow

### Before Starting Work:
```bash
git pull origin master
npm install  # In case dependencies changed
npm run dev
```

### While Working:
- Make your changes
- Test locally at http://localhost:3000
- Browser will auto-reload when you save files

### After Finishing:
```bash
git add .
git commit -m "describe what you did"
git push origin master
```

---

## 🤝 Team Collaboration Rules

1. **Never commit the `.env` file** - It's in `.gitignore` for a reason
2. **Always pull before starting work** - Avoid merge conflicts
3. **Test before pushing** - Make sure it runs on your local
4. **Use clear commit messages** - Help others understand your changes
5. **Ask before changing database schema** - Coordinate with team lead

---

## 📖 Additional Documentation

- **Development Guide:** `DEVELOPMENT.md` - Coding standards and best practices
- **Project Structure:** `STRUCTURE.md` - Detailed folder organization
- **Setup Instructions:** `SETUP.md` - Original setup documentation

---

## 🆘 Need Help?

- **Slack/Discord:** Ask in the team channel
- **Team Lead:** Contact Kamal Singh Dhami
- **GitHub Issues:** Create an issue if you find a bug

---

## 🎉 You're All Set!

Welcome to the Linkup team! Happy coding! 🚀
