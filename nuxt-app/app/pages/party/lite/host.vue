<script setup lang="ts">
definePageMeta({ layout: "party" });
useHead({ title: "GAQ Party - Host" });
</script>

<template>
  <PartyHostGate v-slot="{ status, logout, refresh }">
    <PartyLiteHost :display-url="status.displayUrl" @logout="logout" @session-lost="refresh()" />
  </PartyHostGate>
</template>
