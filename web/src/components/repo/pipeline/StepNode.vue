<template>
  <div
    :title="step.name"
    class="border-wp-background-400 dark:border-wp-background-100 bg-wp-background-200 text-wp-text-100 relative flex min-w-[220px] max-w-[220px] cursor-pointer items-center gap-2 rounded-md border border-l-4 px-3 py-2 shadow-sm transition-colors"
    :style="nodeStyle"
  >
    <Handle type="target" :position="Position.Top" class="pointer-events-none opacity-0" />

    <PipelineStatusIcon :service="step.type === StepType.Service" :status="step.state" class="h-4! w-4! shrink-0" />
    <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ step.name }}</span>
    <PipelineStepDuration :step="step" class="text-wp-text-alt-100 shrink-0 text-xs" />

    <Handle type="source" :position="Position.Bottom" class="pointer-events-none opacity-0" />
  </div>
</template>

<script lang="ts" setup>
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import { Handle, Position } from '@vue-flow/core';

import PipelineStatusIcon from '~/components/repo/pipeline/PipelineStatusIcon.vue';
import PipelineStepDuration from '~/components/repo/pipeline/PipelineStepDuration.vue';
import { StepType } from '~/lib/api/types';
import type { PipelineStatus, PipelineStep } from '~/lib/api/types';

import type { NodeProps } from '@vue-flow/core';

interface StepNodeData {
  step: PipelineStep;
  selected?: boolean;
}

const props = defineProps<NodeProps<StepNodeData>>();

const step = computed(() => props.data.step);
const isSelected = computed(() => Boolean(props.data.selected ?? props.selected));

function getStatusColor(status: PipelineStatus): string {
  switch (status) {
    case 'running':
    case 'started':
      return 'var(--wp-color-state-info-100)';
    case 'success':
      return 'var(--wp-color-state-ok-100)';
    case 'failure':
    case 'error':
    case 'killed':
    case 'declined':
      return 'var(--wp-color-error-100)';
    case 'blocked':
      return 'var(--wp-color-state-warn-100)';
    case 'pending':
    case 'skipped':
    case 'canceled':
    default:
      return 'var(--wp-color-state-neutral-100)';
  }
}

const nodeStyle = computed<CSSProperties>(() => ({
  borderLeftColor: getStatusColor(step.value.state),
  backgroundColor: isSelected.value ? 'var(--wp-color-control-neutral-100)' : undefined,
  boxShadow: isSelected.value ? '0 0 0 2px var(--wp-color-state-info-100)' : undefined,
  opacity: step.value.state === 'skipped' ? 0.65 : 1,
}));
</script>
