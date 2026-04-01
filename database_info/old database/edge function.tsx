// resend-email Edge Function
// Entrypoint: /resend-email
import { createClient } from "npm:@supabase/supabase-js@2.33.0";

interface RequestPayload {
  email?: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

console.info("resend-email function started");

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    // Only allow POST
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Expected application/json" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body: RequestPayload = await req.json();
    const email = (body?.email || "").trim().toLowerCase();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Optional: Rate-limit checks or abuse protections could be added here.
    // Use the Admin (service_role) key to generate a password reset or magic link.
    // Here we send a verification email using the admin endpoint to generate an invited/OTP link.
    // Supabase does not expose a direct "resend verification" via admin client; we trigger a "invite" flow by updating user email confirmation.
    // Using the Admin REST API via supabase-js to resend the invite/confirmation email:
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      // Set a random temporary password so the user receives a confirmation email.
      // If the user exists, creation will fail; we'll detect and fall back to send an invite via update.
      password: crypto.randomUUID() + "Aa1!",
      email_confirm: false,
      // you can set additional user_metadata here if needed
    });

    // If user was created, Supabase may have sent an invite/confirmation. Respond accordingly.
    if (!error) {
      return new Response(JSON.stringify({ status: "ok", message: "Verification (invite) email sent if the user did not already exist." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If createUser failed because the user exists, try sending a new verification via update + send email
    // Common error code: 400 with message containing 'duplicate key' or similar.
    // We'll attempt admin.updateUser to set email_confirm to false which triggers an email resend behavior in some setups.
    // Note: If your Supabase setup uses a custom email provider or different flow, adapt accordingly.
    const findUser = await supabaseAdmin.auth.admin.listUsers();
    if (findUser.error) {
      console.warn("listUsers error:", findUser.error.message);
    } else {
      const existing = findUser.data?.users?.find((u: any) => (u.email || "").toLowerCase() === email);
      if (existing) {
        // Attempt to send a confirmation email by re-sending a password reset link (safe server-side option)
        const resetResp = await supabaseAdmin.auth.resetPasswordForEmail(email, {
          redirectTo: url.origin, // redirect back to your application
        });

        // Note: resetPasswordForEmail returns { data, error } depending on client version; handle generically
        if (resetResp?.error) {
          console.error("resetPasswordForEmail error:", resetResp.error.message || resetResp.error);
          return new Response(JSON.stringify({ error: "Failed to send verification/reset email" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ status: "ok", message: "If an account exists, a reset/verification email was sent." }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // If we reach here, creation failed and no existing user found (or listing failed).
    // Return the original error message safely.
    return new Response(JSON.stringify({ error: error.message || "Failed to resend verification email" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error in resend-email:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});