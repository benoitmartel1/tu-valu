<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { supabase } from "../supabase";
import { Lock } from "@lucide/vue";

const newPassword = ref("");
const confirmPassword = ref("");
const submitting = ref(false);
const message = ref("");
const error = ref("");
const tokenValid = ref(false);

let authListener = null;

onMounted(async () => {
  console.log("ResetPassword mounted");
  console.log("URL:", window.location.href);
  console.log("Hash:", window.location.hash);

  // Listen for auth state changes (Supabase processes the hash asynchronously)
  authListener = supabase.auth.onAuthStateChange((event, session) => {
    console.log("Auth state changed:", event);

    if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
      if (session) {
        console.log("Recovery session established via auth change");
        tokenValid.value = true;
      }
    }
  });

  try {
    // Supabase automatically processes the hash token on page load
    // Just check if we have a valid session
    const { data, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Session error:", sessionError);
      throw sessionError;
    }

    if (data.session) {
      console.log("Session found:", data.session.user?.email);
      // Check if this is a recovery session
      const user = data.session.user;
      if (user) {
        tokenValid.value = true;
        console.log("Recovery session established");
      } else {
        error.value = "Invalid session. Please request a new password reset.";
      }
    } else {
      console.log("No session found, waiting for auth processing...");
      // Wait a bit in case Supabase is still processing the hash
      setTimeout(async () => {
        const { data: retryData } = await supabase.auth.getSession();
        if (retryData?.session) {
          tokenValid.value = true;
          console.log("Session established after retry");
        } else {
          error.value =
            "No recovery token found. Please request a new password reset link.";
        }
      }, 1000);
    }
  } catch (err) {
    console.error("Session error:", err);
    error.value = "Failed to validate recovery link. Please try again.";
  }
});

onUnmounted(() => {
  // Clean up the auth listener
  if (authListener) {
    authListener.data.subscription.unsubscribe();
  }
});

async function handleResetPassword() {
  if (newPassword.value.length < 6) {
    message.value = "Password must be at least 6 characters";
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    message.value = "Passwords do not match";
    return;
  }

  submitting.value = true;
  message.value = "";
  error.value = "";

  try {
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword.value,
    });

    if (updateError) {
      throw updateError;
    }

    message.value = "Password updated successfully! Redirecting to login...";

    // Clear the form
    newPassword.value = "";
    confirmPassword.value = "";

    // Redirect to login after a short delay
    setTimeout(() => {
      window.location.href = "/tu-valu";
    }, 2000);
  } catch (err) {
    error.value = err.message || "Failed to update password";
    console.error("Password update error:", err);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="reset-password-container">
    <div class="reset-password-card">
      <h1>Reset Your Password</h1>

      <!-- Error state -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <!-- Loading/validating state -->
      <div v-if="!tokenValid && !error" class="loading-state">
        <p>Validating recovery link...</p>
      </div>

      <!-- Reset form -->
      <form
        v-if="tokenValid"
        @submit.prevent="handleResetPassword"
        class="reset-form"
      >
        <div class="form-group">
          <label for="new-password">
            <Lock :size="16" />
            New Password
          </label>
          <input
            id="new-password"
            v-model="newPassword"
            type="password"
            placeholder="Enter new password (min 6 characters)"
            required
            minlength="6"
          />
        </div>

        <div class="form-group">
          <label for="confirm-password">
            <Lock :size="16" />
            Confirm Password
          </label>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            placeholder="Confirm new password"
            required
          />
        </div>

        <div v-if="message" class="success-message">
          {{ message }}
        </div>

        <button type="submit" class="submit-btn" :disabled="submitting">
          {{ submitting ? "Updating..." : "Update Password" }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.reset-password-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.reset-password-card {
  background: white;
  border-radius: 12px;
  padding: 40px;
  max-width: 450px;
  width: 100%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

h1 {
  color: #1a1a1a;
  font-size: 24px;
  margin-bottom: 24px;
  text-align: center;
}

.loading-state {
  text-align: center;
  padding: 40px 0;
  color: #666;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: #333;
  font-weight: 500;
  font-size: 14px;
}

input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

input:focus {
  outline: none;
  border-color: #667eea;
}

.submit-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 20px;
  border-left: 4px solid #c33;
}

.success-message {
  background: #efe;
  color: #3c3;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 20px;
  border-left: 4px solid #3c3;
}
</style>
