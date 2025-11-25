<template>
  <main>
    <h1>{{ t('about_title') }}</h1>
    <p>{{ t('about_last_updated', { date: 'June 1, 2024' }) }}</p>
    <section>
      <h2>{{ t('about_section1_title') }}</h2>
      <p>{{ t('about_section1_content') }}</p>
    </section>
    <section>
      <h2>{{ t('about_section2_title') }}</h2>
      <p>{{ t('about_section2_content') }}</p>
    </section>
    <section>
      <h2>{{ t('about_section3_title') }}</h2>
      <p>{{ t('about_section3_content') }}</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from '#imports'
const { t } = useI18n()
</script>