<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Card from 'primevue/card'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { fetchHealth, type Health } from '../api/client'
import { formatDateTime } from '../format'

const health = ref<Health>()
const error = ref<string>()

onMounted(async () => {
  try {
    health.value = await fetchHealth()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})
</script>

<template>
  <h1>Overview</h1>
  <Message v-if="error" severity="error">Gateway unreachable: {{ error }}</Message>
  <Card v-else-if="health">
    <template #title>Gateway</template>
    <template #content>
      <p>
        <Tag :severity="health.gateway === 'UP' ? 'success' : 'danger'" :value="health.gateway" />
      </p>
      <p>Server time: {{ formatDateTime(health.serverTime) }} (Buenos Aires)</p>
    </template>
  </Card>
  <p class="muted">{{ $route.meta.summary }} Planned for {{ $route.meta.milestone }}.</p>
</template>
