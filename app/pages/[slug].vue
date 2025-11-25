<template>
  <section class="home">
    <ClientOnly>
      <MonumentMap />
    </ClientOnly>
  </section>
</template>

<script setup lang="ts">
import MonumentMap from '~/components/MonumentMap.client.vue'

definePageMeta({
  layoutMode: 'zero-padding'
})
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100vw;
  margin: 0;
}
</style>
