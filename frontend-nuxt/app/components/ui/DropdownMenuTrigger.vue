<script setup lang="ts">
import { DropdownMenuTrigger } from 'reka-ui'
// React's version used Base UI's `render={<Button .../>}` prop to merge
// trigger behavior onto a Button. reka-ui's equivalent is as-child with the
// Button as the default slot content.
</script>

<template>
  <DropdownMenuTrigger as-child>
    <slot />
  </DropdownMenuTrigger>
</template>
