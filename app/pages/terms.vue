<template>
  <main>
    <h1>{{ t('terms_title') }}</h1>
    <p>{{ t('terms_last_updated', { date: 'June 1, 2024' }) }}</p>
    <section>
      <h2>{{ t('terms_section1_title') }}</h2>
      <p>{{ t('terms_section1_content') }}</p>
    </section>
    <section>
      <h2>{{ t('terms_section2_title') }}</h2>
      <p>{{ t('terms_section2_content') }}</p>
    </section>
    <section>
      <h2>{{ t('terms_section3_title') }}</h2>
      <p>{{ t('terms_section3_content') }}</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from '#imports'
const { t } = useI18n()
</script>