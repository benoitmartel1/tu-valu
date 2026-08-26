import { ref, computed } from "vue";
import {
  getCurrentUser,
  signOut as supabaseSignOut,
  onAuthStateChange,
} from "../supabase";

// Auth state
const user = ref(null);
const loading = ref(true);
const error = ref(null);
const showAuthModal = ref(false);

// Computed properties
const isAuthenticated = computed(() => !!user.value);
const userEmail = computed(() => user.value?.email || null);
const userId = computed(() => user.value?.id || null);
const userAppMetadata = computed(() => user.value?.user_metadata || {});

// Check if user belongs to tu-valu app
const isTuValuUser = computed(() => {
  return user.value?.user_metadata?.app_name === "tu-valu";
});

// Initialize auth state
export async function initAuth() {
  try {
    loading.value = true;
    error.value = null;

    // Get current user
    const { user: currentUser, error: userError } = await getCurrentUser();

    // No session is normal for first-time users - don't treat as error
    if (userError && userError.message !== "Auth session missing!") {
      throw userError;
    }

    user.value = currentUser || null;

    // Show auth modal if not authenticated
    if (!currentUser) {
      showAuthModal.value = true;
    }

    // Validate app membership if user exists
    if (currentUser && !isTuValuUser.value) {
      console.warn("User does not belong to tu-valu app");
      // Optionally sign out users from other apps
      // await supabaseSignOut()
      // user.value = null
    }
  } catch (err) {
    // Only set error if it's not a session missing error
    if (err.message !== "Auth session missing!") {
      error.value = err.message;
      console.error("Auth initialization error:", err);
    }
    // Show auth modal on error too
    showAuthModal.value = true;
  } finally {
    loading.value = false;
  }

  // Listen for auth state changes
  onAuthStateChange((event, session) => {
    console.log("Auth state changed:", event);
    console.log("Session:", session ? "present" : "null");
    console.log("User:", session?.user?.email || "none");

    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      user.value = session?.user || null;

      // Validate app membership
      if (user.value && user.value.user_metadata?.app_name !== "tu-valu") {
        console.warn("User from different app signed in");
      }

      console.log("User authenticated successfully");
    } else if (event === "SIGNED_OUT") {
      user.value = null;
      showAuthModal.value = true;
      console.log("User signed out");
    } else if (event === "USER_UPDATED") {
      user.value = session?.user || null;
      console.log("User updated");
    } else {
      console.log("Other auth event:", event);
    }

    loading.value = false;
  });
}

// Sign out
export async function signOut() {
  try {
    loading.value = true;
    error.value = null;

    const { error: signOutError } = await supabaseSignOut();

    if (signOutError) {
      throw signOutError;
    }

    user.value = null;
    showAuthModal.value = true;
  } catch (err) {
    error.value = err.message;
    console.error("Sign out error:", err);
  } finally {
    loading.value = false;
  }
}

// Show/hide auth modal
export function showAuth() {
  showAuthModal.value = true;
}

// Export reactive references for use in components
export {
  user,
  loading,
  error,
  showAuthModal,
  isAuthenticated,
  userEmail,
  userId,
  userAppMetadata,
  isTuValuUser,
};

export function hideAuth() {
  showAuthModal.value = false;
}

// Clear error
export function clearError() {
  error.value = null;
}
