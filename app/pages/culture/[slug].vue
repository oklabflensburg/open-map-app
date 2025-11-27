<template>
  <section class="home">
    <ClientOnly>
      <CultureMap />
    </ClientOnly>
  </section>
</template>

<script setup lang="ts">
import CultureMap from '~/components/CultureMap.client.vue'

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
