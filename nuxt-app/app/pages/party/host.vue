<script setup lang="ts">
definePageMeta({ layout: "party" });
useHead({ title: "GAQ Party - Host" });

interface PartyStatus {
  hasPassword: boolean;
  loggedIn: boolean;
  isLoopback: boolean;
  displayUrl: string;
  controlUrls: string[];
}

const PASSWORD_MIN_LENGTH = 6;

const { data: status, pending, error, refresh } = useFetch<PartyStatus>("/api/party/status");

const password = ref("");
const confirmPassword = ref("");
const submitting = ref(false);
const formError = ref<string | null>(null);
const resetting = ref(false);

const view = computed(() => {
  const current = status.value;
  if (!current) return null;
  if (current.loggedIn) return "ready";
  if (current.isLoopback && (resetting.value || !current.hasPassword)) return "setup";
  if (!current.hasPassword) return "setupElsewhere";
  return "login";
});

async function submit(path: "/api/party/password" | "/api/party/login") {
  formError.value = null;
  if (path === "/api/party/password") {
    if (password.value.length < PASSWORD_MIN_LENGTH) {
      formError.value = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
      return;
    }
    if (password.value !== confirmPassword.value) {
      formError.value = "The two passwords don't match.";
      return;
    }
  }
  submitting.value = true;
  try {
    await $fetch(path, { method: "POST", body: { password: password.value } });
    password.value = "";
    confirmPassword.value = "";
    resetting.value = false;
    await refresh();
  } catch (err) {
    formError.value = extractErrorMessage(err, "That didn't work. Try again.");
  } finally {
    submitting.value = false;
  }
}

async function logout() {
  await $fetch("/api/party/logout", { method: "POST" }).catch(() => {});
  await refresh();
}
</script>

<template>
  <main v-if="view === 'ready' && status" class="host-dashboard">
    <PartyHostDashboard
      :display-url="status.displayUrl"
      :control-urls="status.controlUrls"
      :is-loopback="status.isLoopback"
      @logout="logout"
      @session-lost="refresh()"
    />
  </main>
  <main v-else class="host-page">
    <section class="host-card">
      <header class="host-header">
        <MascotKai pose="wave" size="companion" />
        <div>
          <h1 class="host-title">GAQ Party</h1>
          <p class="host-subtitle">Host panel</p>
        </div>
      </header>

      <p v-if="pending && !status" class="host-note">Loading...</p>
      <div v-else-if="error || !status" class="host-error">
        <p>Could not reach the party server.</p>
        <button type="button" class="host-btn host-btn-secondary" @click="refresh()">Try again</button>
      </div>

      <form v-else-if="view === 'setup'" class="host-form" @submit.prevent="submit('/api/party/password')">
        <p class="host-note">
          {{ status.hasPassword ? "Set a new host password. Everyone logged in will need to log in again." : "Set a host password. Anyone who wants to control the game from a phone or another computer needs it." }}
        </p>
        <label class="host-field">
          <span>Password</span>
          <input v-model="password" type="password" autocomplete="new-password" required />
        </label>
        <label class="host-field">
          <span>Confirm password</span>
          <input v-model="confirmPassword" type="password" autocomplete="new-password" required />
        </label>
        <p v-if="formError" class="host-form-error" role="alert">{{ formError }}</p>
        <div class="host-actions">
          <button type="submit" class="host-btn" :disabled="submitting">Set password</button>
          <button v-if="resetting" type="button" class="host-btn host-btn-secondary" @click="resetting = false">Cancel</button>
        </div>
      </form>

      <div v-else-if="view === 'setupElsewhere'" class="host-note-block">
        <p class="host-note">No host password is set yet.</p>
        <p class="host-note">
          Open the host panel on the computer running GAQ Party to set one, then log in here.
        </p>
        <button type="button" class="host-btn host-btn-secondary" @click="refresh()">Check again</button>
      </div>

      <form v-else-if="view === 'login'" class="host-form" @submit.prevent="submit('/api/party/login')">
        <label class="host-field">
          <span>Host password</span>
          <input v-model="password" type="password" autocomplete="current-password" required />
        </label>
        <p v-if="formError" class="host-form-error" role="alert">{{ formError }}</p>
        <div class="host-actions">
          <button type="submit" class="host-btn" :disabled="submitting">Log in</button>
          <button v-if="status.isLoopback" type="button" class="host-btn host-btn-secondary" @click="resetting = true; formError = null">
            Set a new password
          </button>
        </div>
      </form>

    </section>
  </main>
</template>

<style scoped>
.host-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.host-card {
  width: min(460px, 100%);
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.host-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.host-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 26px;
  color: var(--accent);
}

.host-subtitle,
.host-note {
  margin: 0;
  color: var(--muted);
}

.host-note-block,
.host-form,
.host-error {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.host-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.host-actions .host-btn {
  align-self: auto;
}

.host-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 700;
  font-size: 14px;
}

.host-field input {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 16px;
}

.host-form-error,
.host-error p {
  margin: 0;
  color: var(--fail);
  font-weight: 700;
}

.host-btn {
  align-self: flex-start;
  padding: 10px 22px;
  border: 2px solid var(--accent);
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.host-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.host-btn-secondary {
  border-color: var(--accent-secondary);
  background: transparent;
  color: var(--accent-secondary);
}

</style>
