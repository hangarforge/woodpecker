<template>
  <div class="flex items-start gap-2">
    <!-- Commit -->
    <StageCard label="Commit" :subtitle="row.commit.shortSha">
      <p class="text-wp-text-100 line-clamp-2 text-xs">{{ row.commit.message ?? '—' }}</p>
      <p class="text-wp-text-200 text-xs">{{ row.commit.author }}</p>
    </StageCard>

    <Icon name="arrow-right" class="text-wp-text-200 mt-4 h-4 w-4 shrink-0" />

    <!-- Build -->
    <StageCard label="Build" :status="row.build.status" :subtitle="`#${row.build.pipelineNum}`">
      <p class="text-xs">{{ row.build.steps.length }} steps</p>
    </StageCard>

    <Icon name="arrow-right" class="text-wp-text-200 mt-4 h-4 w-4 shrink-0" />

    <!-- Test / Deploy-Test -->
    <StageCard label="Test" :status="row.test.status" :subtitle="`#${row.test.pipelineNum}`">
      <p v-if="row.test.deployedAt" class="text-xs">
        {{ formatDate(row.test.deployedAt) }}
      </p>
    </StageCard>

    <Icon name="arrow-right" class="text-wp-text-200 mt-4 h-4 w-4 shrink-0" />

    <!-- Approval -->
    <StageCard
      label="Approval"
      :status="row.approval?.status ?? (row.test.status === 'success' ? 'pending' : undefined)"
    >
      <template v-if="row.approval">
        <p class="text-xs">{{ row.approval.votes.length }}/{{ row.approval.requiredCount }} votes</p>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="vote in row.approval.votes"
            :key="vote.user.login"
            class="rounded bg-wp-background-300 px-1 py-0.5 text-xs"
          >
            {{ vote.user.login }} {{ vote.decision === 'approved' ? '✓' : '✗' }}
          </span>
        </div>
      </template>
      <template v-else-if="row.test.status === 'success'">
        <Button
          color="blue"
          text="Deploy to Prod"
          start-icon="push"
          :is-loading="deploying"
          class="mt-1 text-xs"
          @click="$emit('trigger', row)"
        />
      </template>
      <template v-else>
        <p class="text-wp-text-200 text-xs">Waiting for test</p>
      </template>
    </StageCard>

    <Icon name="arrow-right" class="text-wp-text-200 mt-4 h-4 w-4 shrink-0" />

    <!-- Prod -->
    <StageCard
      label="Prod"
      :status="row.prod?.status ?? row.promotion?.status ?? undefined"
      :subtitle="row.prod ? `#${row.prod.pipelineNum}` : undefined"
    >
      <p v-if="row.prod?.deployedAt" class="text-xs">
        {{ formatDate(row.prod.deployedAt) }}
      </p>
      <p v-else-if="row.promotion?.status === 'approved'" class="text-xs text-amber-500">
        Deploying…
      </p>
    </StageCard>
  </div>
</template>

<script lang="ts" setup>
import Icon from '~/components/atomic/Icon.vue';
import Button from '~/components/atomic/Button.vue';
import StageCard from './StageCard.vue';
import type { BoardRow } from '~/compositions/usePromotionBoard';

defineProps<{
  row: BoardRow;
  deploying?: boolean;
}>();

defineEmits<{
  (e: 'trigger', row: BoardRow): void;
}>();

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>
