<template>
  <!-- Stage card with colour coding based on status -->
  <div
    class="flex min-w-[120px] flex-col gap-1 rounded-lg border p-3 transition-colors"
    :class="cardClasses"
  >
    <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-70">
      <Icon :name="stageIcon" class="h-4 w-4" />
      {{ label }}
    </div>

    <slot />

    <div v-if="status" class="mt-1 text-xs font-medium capitalize" :class="statusTextClass">
      {{ displayStatus }}
    </div>
    <div v-if="subtitle" class="text-wp-text-200 text-xs truncate">{{ subtitle }}</div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import Icon from '~/components/atomic/Icon.vue';
import type { IconNames } from '~/components/atomic/Icon.vue';

const props = defineProps<{
  label: string;
  icon?: IconNames;
  status?: string; // pending | running | success | failure | approved | deployed | failed | rejected
  subtitle?: string;
}>();

const STATUS_CLASSES: Record<string, string> = {
  success: 'border-wp-control-ok-300 bg-wp-control-ok-100/10',
  approved: 'border-wp-control-ok-300 bg-wp-control-ok-100/10',
  deployed: 'border-wp-control-ok-300 bg-wp-control-ok-100/10',
  failure: 'border-wp-error-300 bg-wp-error-100/10',
  failed: 'border-wp-error-300 bg-wp-error-100/10',
  rejected: 'border-wp-error-300 bg-wp-error-100/10',
  running: 'border-wp-control-info-300 bg-wp-control-info-100/10',
  pending: 'border-amber-400 bg-amber-50/10',
  default: 'border-wp-background-400 bg-wp-background-200',
};

const STATUS_TEXT: Record<string, string> = {
  success: 'text-wp-control-ok-300',
  approved: 'text-wp-control-ok-300',
  deployed: 'text-wp-control-ok-300',
  failure: 'text-wp-error-100',
  failed: 'text-wp-error-100',
  rejected: 'text-wp-error-100',
  running: 'text-wp-control-info-100',
  pending: 'text-amber-500',
};

const STAGE_ICONS: Record<string, IconNames> = {
  Commit: 'commit',
  Build: 'branch',
  Test: 'status-success',
  Approval: 'status-blocked',
  Prod: 'deployment',
};

const cardClasses = computed(() =>
  props.status ? (STATUS_CLASSES[props.status] ?? STATUS_CLASSES.default) : STATUS_CLASSES.default,
);

const statusTextClass = computed(() =>
  props.status ? (STATUS_TEXT[props.status] ?? 'text-wp-text-100') : 'text-wp-text-100',
);

const stageIcon = computed<IconNames>(() =>
  props.icon ?? (STAGE_ICONS[props.label] as IconNames) ?? 'status-pending',
);

const displayStatus = computed(() => {
  if (!props.status) return '';
  return props.status.charAt(0).toUpperCase() + props.status.slice(1);
});
</script>
