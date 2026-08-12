<script setup lang="ts">
import { useIntroBridge } from '../useIntroBridge'

const bridge = useIntroBridge()

function buy(): void {
  bridge?.onOpenPurchaseLink(bridge?.shopItem?.purchaseLink ?? 'https://example.com/fallback')
}
</script>

<template>
  <button @click="buy">Buy (via injected callback)</button>
</template>
