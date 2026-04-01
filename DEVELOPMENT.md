# Linkup Development Guide

## 🎯 Quick Start

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000`

## 📚 Key Concepts

### Authentication Flow

1. **Signup**: User creates account with email/password or Google
2. **Profile Setup**: After signup, user must complete profile (year, section, skills)
3. **GEHU Verification**: Optional but required for recruitment features
4. **Login**: Standard email/password or Google OAuth

### Authorization Levels

- **Unverified User**: Can browse, create profile, but cannot recruit/apply
- **Verified User**: Full access to recruitment and team features
- **Team Leader**: Can post recruitment, review applications
- **Moderator**: Can moderate content, handle reports
- **Super Admin**: Full control over platform

### Data Flow

```
User Action → React Component → Supabase Client → PostgreSQL
                                              ↓
                                    Row Level Security Check
                                              ↓
                                    Response/Real-time Update
```

## 🏗️ Architecture

### Frontend Structure

```
src/
├── components/       # Reusable UI components
├── pages/           # Route-based pages
├── lib/             # Utilities and configs
├── store/           # Global state management
├── types/           # TypeScript definitions
└── hooks/           # Custom React hooks (to be added)
```

### State Management

We use **Zustand** for global state:

```typescript
// authStore.ts
const useAuthStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  signOut: async () => { /* ... */ },
}))
```

Usage:
```typescript
const { user, signOut } = useAuthStore()
```

### Routing

Protected routes check for authentication:

```typescript
<Route element={user ? <MainLayout /> : <Navigate to="/login" />}>
  <Route path="/dashboard" element={<DashboardPage />} />
</Route>
```

## 🔧 Development Workflow

### Adding a New Page

1. Create page component in `src/pages/`
2. Add route in `App.tsx`
3. Update navigation in `Sidebar.tsx` if needed
4. Add any new types to `src/types/`

Example:
```typescript
// src/pages/MyNewPage.tsx
export default function MyNewPage() {
  return <div>My New Page</div>
}

// App.tsx
import MyNewPage from './pages/MyNewPage'
// ... in routes
<Route path="/my-new-page" element={<MyNewPage />} />
```

### Adding a Database Table

1. Update schema in `../temp_database_structure.txt`
2. Run SQL in Supabase Dashboard
3. Update types in `src/types/database.ts`
4. Add RLS policies for security

### Creating a Supabase Query

```typescript
// Fetch data
const { data, error } = await supabase
  .from('teams')
  .select('*, leader:users(*), members:team_members(*, user:users(*))')
  .eq('year', 2)

// Insert data
const { data, error } = await supabase
  .from('teams')
  .insert({ name: 'My Team', leader_id: userId })

// Real-time subscription
const channel = supabase
  .channel('messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `chatroom_id=eq.${chatroomId}`
  }, (payload) => {
    console.log('New message:', payload)
  })
  .subscribe()
```

## 🎨 Styling Guidelines

### Using Tailwind Classes

```typescript
// Good: Semantic, responsive, accessible
<button className="btn-primary hover:shadow-lg active:scale-95 transition-all">
  Click Me
</button>

// Better: Extract to component if reused
<Button variant="primary">Click Me</Button>
```

### Custom Components

Use the predefined classes:
- `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-ghost`
- `.card`, `.card-hover`
- `.badge`, `.badge-primary`, `.badge-success`
- `.input-field`

### Animations

```typescript
import { motion } from 'framer-motion'

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>
```

## 🔒 Security Best Practices

### Row Level Security (RLS)

Always rely on database-level security:

```sql
-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);
```

### Client-Side Checks

Still implement UI-level checks for UX:

```typescript
const { user } = useAuthStore()

if (!user?.gehu_verified) {
  return <div>Please verify your GEHU email first</div>
}
```

### API Keys

- **Never** commit `.env` file
- Use environment variables for all secrets
- Different keys for dev/prod

## 📝 Code Style

### TypeScript

```typescript
// Good: Type everything
interface Props {
  user: User
  onSubmit: (data: FormData) => void
}

// Good: Use enums for constants
enum UserRole {
  Student = 'student',
  Moderator = 'moderator',
  Admin = 'super_admin'
}

// Good: Async/await with error handling
try {
  const data = await fetchData()
  // handle data
} catch (error) {
  toast.error(error.message)
}
```

### React

```typescript
// Good: Functional components with hooks
export default function MyComponent({ data }: Props) {
  const [state, setState] = useState(initialValue)
  
  useEffect(() => {
    // side effects
    return () => {
      // cleanup
    }
  }, [dependencies])
  
  return <div>...</div>
}

// Good: Extract complex logic to custom hooks
function useTeamData(teamId: string) {
  const [team, setTeam] = useState<Team | null>(null)
  // ... logic
  return { team, loading, error }
}
```

## 🧪 Testing (To be added)

### Unit Tests
- Test utility functions
- Test custom hooks
- Test complex components

### Integration Tests
- Test user flows
- Test form submissions
- Test navigation

### E2E Tests
- Test critical user journeys
- Test authentication flows
- Test team creation/joining

## 🐛 Debugging

### React DevTools
- Install React DevTools extension
- Inspect component tree
- Check props and state

### Network Tab
- Monitor Supabase requests
- Check response times
- Verify data structure

### Supabase Dashboard
- Check database directly
- View RLS policies
- Monitor real-time connections

### Common Issues

**Issue**: User not updating after login
**Solution**: Refresh user data in authStore

**Issue**: RLS blocking legitimate queries
**Solution**: Check policies in Supabase Dashboard

**Issue**: Real-time not working
**Solution**: Verify RLS policies allow SELECT on table

## 📦 Build & Deployment

### Development Build
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run preview  # Preview production build locally
```

### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Deploy to Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod
```

### Environment Variables

Set these in your hosting platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 🔄 Database Migrations

When updating schema:

1. Backup current data
2. Write migration SQL
3. Test on development database first
4. Apply to production
5. Update TypeScript types
6. Update any affected queries

## 📊 Performance Optimization

### Code Splitting
```typescript
import { lazy, Suspense } from 'react'

const HeavyComponent = lazy(() => import('./HeavyComponent'))

<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>
```

### Memoization
```typescript
import { useMemo, useCallback } from 'react'

const expensiveValue = useMemo(() => computeExpensive(data), [data])
const memoizedCallback = useCallback(() => doSomething(a), [a])
```

### Database Indexes
Already added in schema for common queries:
- User lookups by email
- Team lookups by year
- Message lookups by chatroom

## 🚀 Feature Implementation Guide

### Adding Real-time Chat

1. Create chatroom (automatically done for teams)
2. Subscribe to messages
3. Display messages
4. Send new messages

```typescript
// Subscribe
useEffect(() => {
  const channel = supabase
    .channel('messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `chatroom_id=eq.${chatroomId}`
    }, (payload) => {
      setMessages(prev => [...prev, payload.new])
    })
    .subscribe()
    
  return () => {
    supabase.removeChannel(channel)
  }
}, [chatroomId])

// Send message
const sendMessage = async (content: string) => {
  await supabase.from('messages').insert({
    chatroom_id: chatroomId,
    sender_id: userId,
    content
  })
}
```

### Implementing Search

```typescript
// Full-text search (already indexed)
const { data } = await supabase
  .from('recruitment_posts')
  .select('*')
  .textSearch('title', searchQuery, {
    type: 'websearch',
    config: 'english'
  })
```

### Adding Notifications

1. Create notification
2. Subscribe to new notifications
3. Display badge count
4. Mark as read

```typescript
// Already implemented in Navbar.tsx
```

## 📱 Mobile Responsiveness

### Breakpoints
- `sm:` 640px
- `md:` 768px
- `lg:` 1024px
- `xl:` 1280px
- `2xl:` 1536px

### Mobile-First Approach
```typescript
// Mobile by default, desktop overrides
<div className="flex flex-col lg:flex-row">
  <aside className="w-full lg:w-64">Sidebar</aside>
  <main className="flex-1">Content</main>
</div>
```

## 🎓 Learning Resources

- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Docs](https://supabase.com/docs)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [React Router](https://reactrouter.com)
- [Framer Motion](https://www.framer.com/motion/)

## 💡 Tips & Tricks

1. **Use TypeScript**: Catch bugs before runtime
2. **Leverage RLS**: Security at database level
3. **Keep components small**: Easier to test and maintain
4. **Use custom hooks**: Reuse stateful logic
5. **Error boundaries**: Graceful error handling
6. **Loading states**: Better UX during async operations
7. **Optimistic updates**: Update UI before server confirms
8. **Debounce search**: Don't query on every keystroke

## 🤝 Contributing

1. Create a feature branch
2. Write clean, typed code
3. Test thoroughly
4. Update documentation
5. Submit PR with clear description

## 📞 Getting Help

- Check documentation first
- Search existing issues on GitHub
- Ask in team chat
- Create detailed bug reports

---

Happy coding! 🚀
