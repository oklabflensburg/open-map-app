<template>
  <section class="home">
    <MonumentsMap />
  </section>
</template>

<script setup lang="ts">
import MonumentsMap from '~/components/MonumentsMap.vue'

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
