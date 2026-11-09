<template>
  <main class="access-denied">
    <section class="surface access-denied-card">
      <p class="eyebrow">403 · ACCESS DENIED</p>
      <h1>This area is not available to your account</h1>
      <p class="muted">Sign in with an account that has the required clinic role.</p>
      <RouterLink class="button button-primary" to="/">Return to the home page</RouterLink>
    </section>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>
