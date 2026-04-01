# Linkup - GEHU PBL Teammate Finder

A modern web application built for GEHU students to find, create, and manage PBL (Project-Based Learning) teams. Connect with talented teammates, showcase your skills, and collaborate on amazing projects.

![Linkup Banner](https://via.placeholder.com/1200x400/0ea5e9/ffffff?text=Linkup+-+Find+Your+Perfect+PBL+Team)

## 🚀 Features

### Core Features (Phase 1)
- **Authentication System**
  - Email/Password signup and login
  - Google OAuth integration
  - GEHU email verification for full access
  
- **User Profiles**
  - Showcase skills, year, and section
  - Optional GitHub and LinkedIn integration
  - Privacy controls for social links

- **Team Management**
  - Create teams of 3-4 members
  - Automatic enforcement of PBL rules (1 member per section)
  - Team leader controls

- **Recruitment Board**
  - Post team openings with required skills
  - Browse and filter recruitment opportunities
  - Apply to teams with custom messages
  - Review and manage applications

- **Messaging System**
  - Direct messages (DM) between users
  - Automatic team group chats
  - Temporary recruitment chats
  - Real-time message updates

- **Admin Dashboard**
  - User management (ban/unban, verify)
  - Team oversight
  - Recruitment moderation
  - Report handling

### Future Features (Phase 2 & 3)
- Event management (hackathons, workshops)
- GitHub project crawler
- Advanced recommendations
- Analytics and insights

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **React Router v6** - Navigation
- **TailwindCSS** - Styling
- **Framer Motion** - Animations
- **Zustand** - State management
- **React Hook Form** - Form handling
- **Lucide React** - Icons
- **React Hot Toast** - Notifications

### Backend
- **Supabase** - Backend as a Service
  - PostgreSQL database
  - Authentication
  - Real-time subscriptions
  - Row Level Security (RLS)
  - Edge Functions
  - Storage

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- Git

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/KamalSDhami/Linkup.git
   cd Linkup/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env`
   ```bash
   cp .env.example .env
   ```
   - The Supabase credentials are already configured in `.env`

4. **Set up Supabase Database**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Open your project (jorhqtihmyjvktcrfzpf)
   - Navigate to SQL Editor
   - Copy the entire schema from `../temp_database_structure.txt`
   - Run the SQL to create all tables, policies, and functions

5. **Run development server**
   ```bash
   npm run dev
   ```
   - App will open at `http://localhost:3000`

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   └── layout/
│   │       ├── AuthLayout.tsx
│   │       ├── MainLayout.tsx
│   │       ├── Navbar.tsx
│   │       └── Sidebar.tsx
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client
│   │   └── utils.ts              # Utility functions
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── SignupPage.tsx
│   │   │   ├── ProfileSetupPage.tsx
│   │   │   └── VerifyEmailPage.tsx
│   │   ├── teams/
│   │   │   ├── TeamsPage.tsx
│   │   │   ├── TeamDetailPage.tsx
│   │   │   └── CreateTeamPage.tsx
│   │   ├── recruitment/
│   │   │   ├── RecruitmentPage.tsx
│   │   │   ├── RecruitmentDetailPage.tsx
│   │   │   └── ApplicationsPage.tsx
│   │   ├── messages/
│   │   │   ├── MessagesPage.tsx
│   │   │   └── ChatPage.tsx
│   │   ├── events/
│   │   │   └── EventsPage.tsx
│   │   ├── admin/
│   │   │   └── AdminDashboardPage.tsx
│   │   ├── LandingPage.tsx
│   │   ├── DashboardPage.tsx
│   │   └── ProfilePage.tsx
│   ├── store/
│   │   └── authStore.ts          # Authentication state
│   ├── types/
│   │   ├── database.ts           # Supabase types
│   │   └── index.ts              # Extended types
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## 🎨 Design System

### Colors
- **Primary**: Blue gradient (`primary-500` to `primary-600`)
- **Accent**: Purple/Pink gradient (`accent-500` to `accent-600`)
- **Neutral**: Slate shades

### Components
- Custom button classes: `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-ghost`
- Card components: `.card`, `.card-hover`
- Badge components: `.badge`, `.badge-primary`, `.badge-success`, `.badge-warning`, `.badge-error`
- Form inputs: `.input-field`

### Animations
- Smooth transitions on all interactions
- Framer Motion for advanced animations
- Custom keyframes: `slide-in`, `fade-in`, `scale-in`

## 🔒 Security

- Row Level Security (RLS) enabled on all tables
- JWT-based authentication via Supabase
- Password hashing handled by Supabase Auth
- GEHU email verification for anti-spam
- Private messaging (no external contact sharing)

## 🚦 Getting Started Guide

### For Students

1. **Sign Up**
   - Create account with email or Google
   - Verify your GEHU email to unlock recruitment

2. **Set Up Profile**
   - Add your year, section, and skills
   - Optionally add GitHub/LinkedIn
   - Choose social link visibility

3. **Find a Team**
   - Browse recruitment board
   - Filter by year, skills, and section
   - Apply with a personalized message

4. **Create Your Own Team**
   - Click "Create Team" in Teams section
   - Add team name and description
   - Post recruitment openings
   - Review applications and build your team

5. **Collaborate**
   - Use team chat for coordination
   - Message team members directly
   - Stay updated with notifications

### For Team Leaders

1. **Post Recruitment**
   - Describe your project and required skills
   - Set number of positions available
   - Wait for applications

2. **Review Applications**
   - View applicant profiles
   - Check their skills and experience
   - Chat temporarily during recruitment
   - Accept or reject applications

3. **Manage Team**
   - Members auto-added when accepted
   - Team chat auto-created
   - Coordinate via built-in messaging

## 📊 Database Schema

Refer to `../temp_database_structure.txt` for the complete database schema including:
- 13 tables with relationships
- Row Level Security policies
- Triggers and functions
- Indexes for performance
- Storage bucket configuration

Key tables:
- `users` - User profiles and auth
- `teams` - Team information
- `team_members` - Team membership
- `recruitment_posts` - Job openings
- `applications` - Application tracking
- `chatrooms` - Chat conversations
- `messages` - Message content
- `notifications` - In-app notifications

## 🤝 Contributing

This project is built for GEHU students. To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

MIT License - See LICENSE file for details

## 👥 Team

Built with ❤️ by GEHU students for GEHU students

## 🐛 Bug Reports

Found a bug? Please open an issue on GitHub with:
- Description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

## 📞 Support

For questions or support:
- Open an issue on GitHub
- Contact via GEHU email

## 🗺️ Roadmap

### Phase 1 (MVP) ✅
- [x] Authentication system
- [x] User profiles
- [x] Team creation and management
- [x] Recruitment board
- [x] Messaging system
- [x] Admin dashboard
- [ ] Complete all page implementations

### Phase 2
- [ ] Events management
- [ ] Enhanced recruitment dashboard
- [ ] Advanced search and filters
- [ ] Temporary recruitment chats

### Phase 3
- [ ] GitHub project crawler
- [ ] Recommendations engine
- [ ] Analytics and insights
- [ ] Mobile app (React Native)

## 🎯 Project Goals

1. **Simplify Team Formation**: Make it easy for students to find compatible teammates
2. **Skill Showcase**: Allow students to highlight their abilities
3. **Privacy First**: Keep contact information private and secure
4. **Collaborative**: Built-in tools for team coordination
5. **Scalable**: Designed to grow with GEHU's needs

---

Made with 💙 for GEHU Students | [GitHub](https://github.com/KamalSDhami/Linkup)
