<script setup lang="ts">
// Local wrapper over @hugeicons/core-free-icons, replacing @hugeicons/react's
// HugeiconsIcon. The icon data ships as React-style [tag, attrs] tuples with
// camelCase SVG attribute names (e.g. strokeLinejoin, strokeWidth). Vue's
// runtime sets unknown props on SVG elements via setAttribute() verbatim, so
// camelCase attrs render as no-op attributes and icons lose their strokes
// silently. Every attr key must be kebab-cased before being bound.
//
// Two-tone/alt-icon support (altIcon, showAlt, primaryColor, secondaryColor)
// from the React version is intentionally omitted — no call site in this app
// uses it. Add @hugeicons/vue instead if that's ever needed.

// @hugeicons/core-free-icons doesn't export its `IconSvgObject` type, only
// icon constants typed with it — reconstructed here to match structurally
// (mutable and readonly tuple forms, matching the package's own definition).
type IconSvgObject =
  | [string, { [key: string]: string | number }][]
  | readonly (readonly [string, { readonly [key: string]: string | number }])[]

const props = withDefaults(
  defineProps<{
    icon: IconSvgObject
    size?: number | string
    strokeWidth?: number | string
    color?: string
  }>(),
  {
    size: 24,
    strokeWidth: undefined,
    color: 'currentColor',
  }
)

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

const children = computed(() =>
  props.icon.map(([tag, attrs]) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'key') continue
      out[kebab(k)] = v
    }
    if (props.strokeWidth !== undefined) {
      out['stroke-width'] = props.strokeWidth
    }
    return { tag, attrs: out }
  })
)
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    :color="color"
  >
    <component :is="c.tag" v-for="(c, i) in children" :key="i" v-bind="c.attrs" />
  </svg>
</template>
