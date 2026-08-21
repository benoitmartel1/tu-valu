import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Authentication helper functions
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        app_name: "tu-valu",
      },
    },
  });
  return { data, error };
}

export async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Sign in error:", error.message, error.status);
    }

    return { data, error };
  } catch (err) {
    console.error("Sign in exception:", err);
    return { data: null, error: err };
  }
}

export async function signInWithMagicLink(email) {
  try {
    console.log("Sending magic link to:", email);

    // Build the correct redirect URL including the /tu-valu subdirectory
    const baseUrl = window.location.origin;
    const redirectUrl = baseUrl.includes("/tu-valu")
      ? baseUrl
      : `${baseUrl}/tu-valu`;

    console.log("Redirect URL:", redirectUrl);

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectUrl,
        data: {
          app_name: "tu-valu",
        },
      },
    });

    if (error) {
      console.error("Magic link error:", error.message, error.status);
    } else {
      console.log("Magic link sent successfully");
    }

    return { data, error };
  } catch (err) {
    console.error("Magic link exception:", err);
    return { data: null, error: err };
  }
}

export async function signInWithProvider(provider) {
  // Build the correct redirect URL including the /tu-valu subdirectory
  const baseUrl = window.location.origin;
  const redirectUrl = baseUrl.includes("/tu-valu")
    ? baseUrl
    : `${baseUrl}/tu-valu`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl,
    },
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { user, error };
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

export async function resetPassword(email) {
  // Build the correct redirect URL including the /tu-valu subdirectory
  const baseUrl = window.location.origin;
  const redirectUrl = baseUrl.includes("/tu-valu")
    ? baseUrl
    : `${baseUrl}/tu-valu`;
  
  console.log("Password reset redirect URL:", `${redirectUrl}/reset-password`);

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${redirectUrl}/reset-password`,
  });
  
  if (error) {
    console.error("Password reset error:", error.message);
  } else {
    console.log("Password reset email sent successfully");
  }
  
  return { data, error };
}
