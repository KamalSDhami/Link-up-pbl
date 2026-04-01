# Login Stuck Bug - Comprehensive Fix

## Problem Report
After creating a new account and trying to login:
1. User creates account
2. Gets redirected (to login instead of profile-setup?)
3. Tries to login
4. Sees "Welcome back!" toast
5. **STUCK on login page** - no redirect happens

## Root Causes Identified

### Issue 1: Auth State Loading Not Properly Managed
The `isLoading` state in `authStore.ts` was not being set to `false` consistently, causing the app to show loading spinner indefinitely in some cases.

### Issue 2: AuthLayout Not Checking Loading State
The `AuthLayout` was checking for `user` immediately without waiting for the loading state to complete, potentially causing race conditions.

### Issue 3: No Debugging Visibility
There were no console logs to help diagnose where the auth flow was failing.

## Solutions Applied

### 1. Fixed Auth Store Loading State
**File:** `src/store/authStore.ts`

```typescript
// Initialize auth state
supabase.auth.getSession().then(({ data: { session } }) => {
  useAuthStore.setState({ session })
  if (session) {
    supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching user profile:', error)
        }
        // IMPORTANT: Set isLoading to false after fetching user
        useAuthStore.setState({ user: data, isLoading: false })
      })
  } else {
    // IMPORTANT: Set isLoading to false even when no session
    useAuthStore.setState({ isLoading: false })
  }
})

// Listen to auth changes
supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.setState({ session })
  if (session) {
    supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching user profile:', error)
        }
        // IMPORTANT: Always set isLoading to false
        useAuthStore.setState({ user: data, isLoading: false })
      })
  } else {
    useAuthStore.setState({ user: null, isLoading: false })
  }
})
```

### 2. Enhanced AuthLayout with Loading State
**File:** `src/components/layout/AuthLayout.tsx`

```typescript
export default function AuthLayout() {
  const { user, session, isLoading } = useAuthStore()

  // Debug logging
  useEffect(() => {
    console.log('AuthLayout state:', { user: !!user, session: !!session, isLoading })
  }, [user, session, isLoading])

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // If user is already logged in, redirect to dashboard
  if (user) {
    console.log('User is logged in, redirecting to dashboard')
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  )
}
```

### 3. Added Debug Logging to Login
**File:** `src/pages/auth/LoginPage.tsx`

```typescript
if (data.session) {
  console.log('Login successful, session created:', data.session.user.id)
  toast.success('Welcome back!')
  // AuthLayout will handle the redirect once user state updates
}
```

### 4. Enhanced Signup Flow
**File:** `src/pages/auth/SignupPage.tsx`

```typescript
if (authData.user) {
  console.log('User created:', authData.user.id)
  toast.success('Account created! Please set up your profile.')
  
  // Wait a bit for the trigger to create the user profile
  await new Promise(resolve => setTimeout(resolve, 500))
  
  navigate('/profile-setup')
}
```

## Testing Steps

### 1. Test New Account Creation
1. Go to `/signup`
2. Fill in name, email, password
3. Click "Create Account"
4. **Check console:** Should see "User created: [user-id]"
5. **Expected:** Redirect to `/profile-setup`

### 2. Test Profile Setup
1. Fill in year, section, at least one skill
2. Click "Complete Setup"
3. **Expected:** Redirect to `/dashboard`

### 3. Test Login After Signup
1. Sign out
2. Go to `/login`
3. Enter credentials
4. **Check console:** Should see:
   - "Login successful, session created: [user-id]"
   - "AuthLayout state: { user: false, session: true, isLoading: false }" (briefly)
   - "AuthLayout state: { user: true, session: true, isLoading: false }"
   - "User is logged in, redirecting to dashboard"
5. **Expected:** Redirect to `/dashboard`

### 4. Test Already Logged In
1. While logged in, try to go to `/login`
2. **Check console:** Should see "User is logged in, redirecting to dashboard"
3. **Expected:** Immediate redirect to `/dashboard`

## Debugging Checklist

If login still doesn't work, check browser console for:

### ✅ Signup Flow:
- [ ] "User created: [uuid]" appears
- [ ] No errors in console
- [ ] Redirects to `/profile-setup`

### ✅ Login Flow:
- [ ] "Login successful, session created: [uuid]" appears
- [ ] "AuthLayout state:" logs show progression from `isLoading: true` → `isLoading: false`
- [ ] `user` changes from `false` to `true` in logs
- [ ] "User is logged in, redirecting to dashboard" appears
- [ ] Actually redirects to `/dashboard`

### ❌ If Still Stuck:
Check for these issues:

1. **Database trigger not working:**
   - Check Supabase dashboard → Database → Triggers
   - Verify `on_auth_user_created` trigger exists
   - Test manually: Sign up and check if user appears in `public.users` table

2. **RLS policies blocking user fetch:**
   - Check Supabase dashboard → Authentication → Policies
   - Verify "Users can view own profile" policy exists
   - Test query manually in SQL editor

3. **Session not persisting:**
   - Check browser localStorage for `supabase.auth.token`
   - Clear browser cache and try again

## Additional Notes

### Why the 500ms delay in signup?
The database trigger that creates the user profile runs asynchronously. The small delay ensures the profile exists before navigating to profile-setup.

### Why not use `navigate()` in LoginPage?
The AuthLayout automatically redirects authenticated users. Using `navigate()` in both places could cause race conditions.

### When should I see the loading spinner?
- Briefly when the app first loads
- In AuthLayout when waiting for auth state to resolve
- Never indefinitely (if it does, that's the bug)

---

## Expected Flow Diagram

```
SIGNUP:
User fills form → signUp() → 
  Database trigger creates profile → 
    500ms wait → 
      Navigate to /profile-setup →
        Fill profile → 
          Navigate to /dashboard

LOGIN (First Time):
User enters credentials → signInWithPassword() →
  onAuthStateChange fires →
    Fetch user from database →
      Update store (user: data, isLoading: false) →
        AuthLayout detects user exists →
          Redirect to /dashboard ✅

LOGIN (Already Logged In):
Visit /login →
  AuthLayout checks user →
    User exists →
      Immediate redirect to /dashboard ✅
```

---

**Fixed:** October 11, 2025
**Files Modified:** 
- `src/store/authStore.ts`
- `src/components/layout/AuthLayout.tsx`
- `src/pages/auth/LoginPage.tsx`
- `src/pages/auth/SignupPage.tsx`
