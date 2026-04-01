# 🚀 Linkup Setup Guide

Complete step-by-step guide to set up the Linkup application from scratch.

## Prerequisites

- [x] Node.js 18+ installed
- [x] Git installed
- [x] A code editor (VS Code recommended)
- [x] Supabase account (already created)

## Part 1: Frontend Setup

### 1. Navigate to Frontend Directory

```powershell
cd "c:\Users\Kamal Singh Dhami\Documents\Coding\Git\Linkup\frontend"
```

### 2. Install Dependencies

Dependencies are already installed! If you need to reinstall:

```powershell
npm install
```

### 3. Environment Configuration

The `.env` file is already configured with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://jorhqtihmyjvktcrfzpf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

✅ **No action needed** - credentials are already set up!

### 4. Start Development Server

```powershell
npm run dev
```

The app will open at `http://localhost:3000`

## Part 2: Database Setup

### Step 1: Access Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign in to your account
3. Select your project: **Linkup Project** (ID: jorhqtihmyjvktcrfzpf)

### Step 2: Open SQL Editor

1. In the left sidebar, click on **SQL Editor**
2. Click **New Query** to create a new SQL query

### Step 3: Copy Database Schema

1. Open the file: `c:\Users\Kamal Singh Dhami\Documents\Coding\Git\Linkup\temp_database_structure.txt`
2. Copy **ALL** the content (it's a long file with table definitions, policies, triggers, etc.)

### Step 4: Execute Schema

1. Paste the entire schema into the SQL Editor
2. Click **Run** (or press Ctrl+Enter)
3. Wait for execution to complete (may take 10-30 seconds)

You should see success messages for:
- ✅ Tables created
- ✅ Indexes created
- ✅ RLS policies applied
- ✅ Triggers created
- ✅ Functions created

### Step 5: Verify Setup

Run this query to verify tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see:
- applications
- chatroom_members
- chatrooms
- event_participants (Phase 3)
- events (Phase 3)
- messages
- notifications
- recruitment_posts
- reports
- team_members
- teams
- users
- verification_codes

### Step 6: Enable Storage (Optional)

For profile pictures:

1. Go to **Storage** in the sidebar
2. Click **Create a new bucket**
3. Name it: `profile-pictures`
4. Set it as **Public bucket**
5. Click **Create bucket**

Or run this SQL:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true);
```

### Step 7: Configure Authentication

1. Go to **Authentication** → **Providers** in the sidebar
2. Enable **Email** provider (should be enabled by default)
3. Optional: Enable **Google** provider
   - Add Google OAuth credentials
   - Set redirect URL: `http://localhost:3000`

## Part 3: Testing the Setup

### Test 1: Can the App Connect?

1. Start dev server: `npm run dev`
2. Open browser to `http://localhost:3000`
3. You should see the landing page

✅ **Success**: App loads without errors

### Test 2: Can You Sign Up?

1. Click **Get Started** or **Sign Up**
2. Fill in the form:
   - Name: Test User
   - Email: test@example.com
   - Password: test123
3. Click **Create Account**

⚠️ **Expected**: You'll see an error about profile setup because we need to create a user in the database first. This is NORMAL!

### Test 3: Database Trigger Test

After signup, check if the user was created:

```sql
SELECT id, email, name, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 1;
```

You should see your test user!

## Part 4: Creating Your First Admin User

### Option A: Via SQL (Recommended)

1. First, sign up normally through the UI
2. Then run this SQL to make yourself admin:

```sql
-- Find your user ID
SELECT id, email FROM auth.users WHERE email = 'your@email.com';

-- Update role to super_admin
UPDATE users 
SET role = 'super_admin', 
    gehu_verified = true
WHERE id = 'your-user-id-here';
```

### Option B: Manual Database Entry

If you haven't signed up yet:

```sql
-- This creates a user directly (for development only)
-- In production, users should sign up through the app

INSERT INTO users (
  id,
  email,
  name,
  section,
  year,
  role,
  gehu_verified
) VALUES (
  gen_random_uuid(),
  'admin@gehu.ac.in',
  'Admin User',
  'A',
  4,
  'super_admin',
  true
);
```

## Part 5: Development Workflow

### Daily Development

```powershell
# 1. Navigate to frontend
cd "c:\Users\Kamal Singh Dhami\Documents\Coding\Git\Linkup\frontend"

# 2. Start dev server
npm run dev

# 3. Start coding!
```

### Making Database Changes

1. Update `temp_database_structure.txt` with new schema
2. Run the new SQL in Supabase Dashboard
3. Update TypeScript types in `src/types/database.ts`
4. Update any affected queries in your code

### Adding New Features

1. Read `DEVELOPMENT.md` for guidelines
2. Create new components/pages as needed
3. Update routes in `App.tsx`
4. Test thoroughly
5. Commit changes to Git

## Part 6: Troubleshooting

### Issue: "Cannot find module" errors

**Solution**: Install dependencies
```powershell
npm install
```

### Issue: "Supabase connection failed"

**Solution**: Check `.env` file has correct credentials

### Issue: "Permission denied" when querying

**Solution**: Check RLS policies in Supabase Dashboard

### Issue: Real-time not working

**Solution**: 
1. Check RLS policies allow SELECT
2. Verify you're subscribed to the correct channel
3. Check browser console for errors

### Issue: Can't sign in after signup

**Solution**: 
1. Check if user exists in `auth.users`
2. Verify password is correct
3. Check RLS policies on `users` table

## Part 7: Next Steps

Now that setup is complete:

### Immediate Tasks

1. ✅ Database schema applied
2. ✅ Frontend running
3. ✅ Can view landing page
4. 🔄 Create your admin user
5. 🔄 Test signup/login flow
6. 🔄 Complete profile setup page
7. 🔄 Start building team features

### Learning the Codebase

1. Read `README.md` for project overview
2. Read `DEVELOPMENT.md` for coding guidelines
3. Explore the `src/` directory structure
4. Check out the database schema in detail
5. Review the existing pages and components

### Building Features

Follow the roadmap in `README.md`:

**Phase 1 (MVP)**
- [x] Auth system (Login/Signup done)
- [ ] Complete profile setup
- [ ] Team creation
- [ ] Recruitment board
- [ ] Messaging system
- [ ] Admin dashboard

**Phase 2**
- [ ] Events management
- [ ] Enhanced features

**Phase 3**
- [ ] GitHub crawler
- [ ] Recommendations
- [ ] Mobile app

## Part 8: Useful Commands

```powershell
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build

# Linting
npm run lint             # Run ESLint

# Git
git status               # Check what changed
git add .                # Stage all changes
git commit -m "message"  # Commit changes
git push                 # Push to GitHub
```

## Part 9: Resources

### Documentation
- [React](https://react.dev)
- [TypeScript](https://www.typescriptlang.org/docs)
- [Supabase](https://supabase.com/docs)
- [TailwindCSS](https://tailwindcss.com/docs)
- [Vite](https://vitejs.dev)

### Project Files
- `README.md` - Project overview
- `DEVELOPMENT.md` - Development guide
- `temp_database_structure.txt` - Database schema

### Supabase Dashboard Sections
- **SQL Editor**: Run queries
- **Table Editor**: View/edit data
- **Authentication**: Manage users
- **Storage**: File uploads
- **Database**: Schema & policies
- **API Docs**: Auto-generated API reference

## 🎉 Setup Complete!

You're all set to start developing Linkup! 

### Quick Start Checklist

- [x] Frontend dependencies installed
- [x] Environment variables configured
- [x] Database schema ready to deploy
- [x] Development server can run
- [ ] Database schema applied in Supabase
- [ ] First user created
- [ ] Ready to code!

### Next Action

**Run the database schema NOW:**
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy & paste `temp_database_structure.txt`
4. Click Run
5. Come back and start coding!

---

Need help? Check `DEVELOPMENT.md` or create an issue on GitHub!

Happy coding! 🚀
