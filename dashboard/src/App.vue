<script setup lang="ts">
import { routes } from './router'
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">
        <img src="/favicon.svg" alt="" width="28" height="28" />
        <span>Dual Investment Bot</span>
      </div>
      <nav>
        <RouterLink v-for="route in routes" :key="route.path" :to="route.path" class="nav-link">
          <i :class="route.meta?.icon" />
          <span>{{ route.meta?.title }}</span>
        </RouterLink>
      </nav>
    </aside>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>
