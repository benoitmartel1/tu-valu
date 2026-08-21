<script setup>
import { ref, computed } from "vue";
import { X, Mail, Lock, User } from "@lucide/vue";
import {
  signUp,
  signIn,
  signInWithMagicLink,
  signInWithProvider,
  resetPassword,
} from "../supabase";
import {
  showAuthModal,
  hideAuth,
  error as authError,
  clearError,
} from "../stores/auth";

const activeTab = ref("login"); // 'login', 'signup', 'magic-link', 'forgot-password'
const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const submitting = ref(false);
const message = ref("");

const isValidEmail = computed(() => {
  return email.value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value);
});

const passwordsMatch = computed(() => {
  return password.value === confirmPassword.value;
});

async function handleSignUp() {
  if (!isValidEmail.value) {
    message.value = "Please enter a valid email address";
    return;
  }

  if (password.value.length < 6) {
    message.value = "Password must be at least 6 characters";
    return;
  }

  if (!passwordsMatch.value) {
    message.value = "Passwords do not match";
    return;
  }

  submitting.value = true;
  message.value = "";
  clearError();

  try {
    const { data, error } = await signUp(email.value, password.value);

    if (error) {
      throw error;
    }

    message.value = "Account created! Please check your email to confirm.";
    email.value = "";
    password.value = "";
    confirmPassword.value = "";
  } catch (err) {
    message.value = err.message || "Sign up failed";
  } finally {
    submitting.value = false;
  }
}

async function handleSignIn() {
  if (!isValidEmail.value) {
    message.value = "Please enter a valid email address";
    return;
  }

  if (!password.value) {
    message.value = "Please enter your password";
    return;
  }

  submitting.value = true;
  message.value = "";
  clearError();

  try {
    const { data, error } = await signIn(email.value, password.value);

    if (error) {
      // Provide more helpful error messages
      if (error.message.includes("Invalid login credentials")) {
        throw new Error(
          "Invalid email or password. Please check your credentials.",
        );
      } else if (error.message.includes("Email not confirmed")) {
        throw new Error("Please confirm your email address before logging in.");
      } else if (error.status === 400) {
        throw new Error("Login failed. Please check your email and password.");
      } else {
        throw error;
      }
    }

    hideAuth();
    email.value = "";
    password.value = "";
  } catch (err) {
    message.value = err.message || "Login failed";
    console.error("Login error details:", err);
  } finally {
    submitting.value = false;
  }
}

async function handleMagicLink() {
  if (!isValidEmail.value) {
    message.value = "Please enter a valid email address";
    return;
  }

  submitting.value = true;
  message.value = "";
  clearError();

  try {
    const { data, error } = await signInWithMagicLink(email.value);

    if (error) {
      throw error;
    }

    message.value = "Check your email for the magic link!";
    email.value = "";
  } catch (err) {
    message.value = err.message || "Failed to send magic link";
  } finally {
    submitting.value = false;
  }
}

async function handleResetPassword() {
  if (!isValidEmail.value) {
    message.value = "Please enter a valid email address";
    return;
  }

  submitting.value = true;
  message.value = "";
  clearError();

  try {
    const { data, error } = await resetPassword(email.value);

    if (error) {
      throw error;
    }

    message.value = "Password reset email sent! Check your inbox.";
    email.value = "";
  } catch (err) {
    message.value = err.message || "Failed to send reset email";
  } finally {
    submitting.value = false;
  }
}

async function handleSocialLogin(provider) {
  try {
    await signInWithProvider(provider);
    // Note: This will redirect to the provider's OAuth page
  } catch (err) {
    message.value = err.message || `Failed to sign in with ${provider}`;
  }
}

function closeModal() {
  hideAuth();
  message.value = "";
  clearError();
}

function switchTab(tab) {
  activeTab.value = tab;
  message.value = "";
  clearError();
}
</script>

<template>
  <div v-if="showAuthModal" class="auth-modal-overlay">
    <div class="auth-modal">
      <button class="close-btn" @click="closeModal">
        <X :size="20" />
      </button>

      <div class="auth-header">
        <h2>Welcome to Tu-Valu</h2>
        <p>Sign in to access your classes and evaluations</p>
      </div>

      <!-- Tabs -->
      <div class="auth-tabs">
        <button
          :class="['tab-btn', { active: activeTab === 'login' }]"
          @click="switchTab('login')"
        >
          Login
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'signup' }]"
          @click="switchTab('signup')"
        >
          Sign Up
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'magic-link' }]"
          @click="switchTab('magic-link')"
        >
          Magic Link
        </button>
      </div>

      <!-- Error message -->
      <div v-if="authError || message" class="error-message">
        {{ authError || message }}
      </div>

      <!-- Login Form -->
      <form
        v-if="activeTab === 'login'"
        @submit.prevent="handleSignIn"
        class="auth-form"
      >
        <div class="form-group">
          <label for="login-email">
            <Mail :size="16" />
            Email
          </label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            placeholder="your@email.com"
            required
          />
        </div>

        <div class="form-group">
          <label for="login-password">
            <Lock :size="16" />
            Password
          </label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" class="submit-btn" :disabled="submitting">
          {{ submitting ? "Signing in..." : "Sign In" }}
        </button>

        <div class="form-footer">
          <button
            type="button"
            class="link-btn"
            @click="switchTab('forgot-password')"
          >
            Forgot password?
          </button>
        </div>
      </form>

      <!-- Sign Up Form -->
      <form
        v-if="activeTab === 'signup'"
        @submit.prevent="handleSignUp"
        class="auth-form"
      >
        <div class="form-group">
          <label for="signup-email">
            <Mail :size="16" />
            Email
          </label>
          <input
            id="signup-email"
            v-model="email"
            type="email"
            placeholder="your@email.com"
            required
          />
        </div>

        <div class="form-group">
          <label for="signup-password">
            <Lock :size="16" />
            Password
          </label>
          <input
            id="signup-password"
            v-model="password"
            type="password"
            placeholder="Min 6 characters"
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
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" class="submit-btn" :disabled="submitting">
          {{ submitting ? "Creating account..." : "Create Account" }}
        </button>
      </form>

      <!-- Magic Link Form -->
      <form
        v-if="activeTab === 'magic-link'"
        @submit.prevent="handleMagicLink"
        class="auth-form"
      >
        <div class="form-group">
          <label for="magic-email">
            <Mail :size="16" />
            Email
          </label>
          <input
            id="magic-email"
            v-model="email"
            type="email"
            placeholder="your@email.com"
            required
          />
        </div>

        <p class="info-text">
          We'll send you a magic link to sign in without a password.
        </p>

        <button type="submit" class="submit-btn" :disabled="submitting">
          {{ submitting ? "Sending..." : "Send Magic Link" }}
        </button>
      </form>

      <!-- Forgot Password Form -->
      <form
        v-if="activeTab === 'forgot-password'"
        @submit.prevent="handleResetPassword"
        class="auth-form"
      >
        <div class="form-group">
          <label for="reset-email">
            <Mail :size="16" />
            Email
          </label>
          <input
            id="reset-email"
            v-model="email"
            type="email"
            placeholder="your@email.com"
            required
          />
        </div>

        <p class="info-text">We'll send you a link to reset your password.</p>

        <button type="submit" class="submit-btn" :disabled="submitting">
          {{ submitting ? "Sending..." : "Send Reset Link" }}
        </button>

        <div class="form-footer">
          <button type="button" class="link-btn" @click="switchTab('login')">
            Back to login
          </button>
        </div>
      </form>

      <!-- Social Login -->
      <div class="social-login">
        <div class="divider">
          <span>Or continue with</span>
        </div>

        <div class="social-buttons">
          <button
            type="button"
            class="social-btn github"
            @click="handleSocialLogin('github')"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
              />
            </svg>
            GitHub
          </button>

          <button
            type="button"
            class="social-btn google"
            @click="handleSocialLogin('google')"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.auth-modal {
  background: var(--bg-dark);
  border-radius: 12px;
  padding: 32px;
  max-width: 450px;
  width: 100%;
  position: relative;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: var(--text-light);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.auth-header {
  text-align: center;
  margin-bottom: 24px;
}

.auth-header h2 {
  font-size: 24px;
  margin-bottom: 8px;
  color: var(--text-light);
}

.auth-header p {
  color: var(--text-muted);
  font-size: 14px;
}

.auth-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 2px solid var(--border-color);
}

.tab-btn {
  flex: 1;
  padding: 12px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}

.tab-btn:hover {
  color: var(--text-light);
}

.tab-btn.active {
  color: var(--accent-color);
  border-bottom-color: var(--accent-color);
}

.error-message {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-light);
  font-weight: 500;
}

.form-group input {
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-darker);
  color: var(--text-light);
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.info-text {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}

.submit-btn {
  padding: 12px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  margin-top: 8px;
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-footer {
  text-align: center;
  margin-top: 8px;
}

.link-btn {
  background: none;
  border: none;
  color: var(--accent-color);
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
}

.link-btn:hover {
  opacity: 0.8;
}

.social-login {
  margin-top: 24px;
}

.divider {
  position: relative;
  text-align: center;
  margin: 24px 0;
}

.divider::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--border-color);
}

.divider span {
  background: var(--bg-dark);
  padding: 0 16px;
  position: relative;
  color: var(--text-muted);
  font-size: 13px;
}

.social-buttons {
  display: flex;
  gap: 12px;
}

.social-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-darker);
  color: var(--text-light);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.social-btn:hover {
  background: var(--bg-dark);
  border-color: var(--text-muted);
}

.social-btn.github:hover {
  border-color: #6e7681;
}

.social-btn.google:hover {
  border-color: #4285f4;
}
</style>
