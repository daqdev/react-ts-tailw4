<script setup lang="ts">
import Card from 'primevue/card'
import Tag from 'primevue/tag'
</script>

<template>
  <h1>{{ $route.meta.title }}</h1>
  <Card>
    <template #content>
      <p>{{ $route.meta.summary }}</p>
      <Tag severity="secondary" :value="`Planned for ${$route.meta.milestone}`" />
    </template>
  </Card>
</template>
