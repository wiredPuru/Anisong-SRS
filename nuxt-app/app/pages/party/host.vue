<script setup lang="ts">
definePageMeta({ layout: "party" });
useHead({ title: "GAQ Party - Host" });
</script>

<template>
  <PartyHostGate v-slot="{ status, logout, refresh }">
    <main class="host-dashboard">
      <PartyHostDashboard
        :display-url="status.displayUrl"
        :control-urls="status.controlUrls"
        :is-loopback="status.isLoopback"
        @logout="logout"
        @session-lost="refresh()"
      />
    </main>
  </PartyHostGate>
</template>
