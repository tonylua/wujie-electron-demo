<script setup lang="ts">
import PurchasePanel from './components/PurchasePanel.vue'
import { useIntroBridge } from './useIntroBridge'

const bridge = useIntroBridge()
</script>

<template>
  <div class="vue-test">
    <h2>Vue SFC + provide/inject</h2>
    <p>shopItem.name: <b>{{ bridge?.shopItem?.name ?? 'MISSING' }}</b></p>
    <p>locale: <b>{{ bridge?.locale ?? 'MISSING' }}</b></p>
    <PurchasePanel />
  </div>
</template>

<style>
.vue-test { padding: 24px; font-family: sans-serif; }
.vue-test h2 { margin-bottom: 12px; }
.vue-test p { margin: 6px 0; }
</style>
