<template>
  <Container full-width class="flex flex-col gap-6 p-4 md:p-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold">{{ $t('promotion.board_title') }}</h1>
        <p class="text-wp-text-200 text-sm">
          {{ $t('promotion.board_subtitle') }}
          <span v-if="board?.updatedAt" class="ml-2 text-xs opacity-60">
            Updated {{ formatDate(board.updatedAt) }}
          </span>
        </p>
      </div>
      <Button
        color="gray"
        :text="$t('promotion.refresh')"
        start-icon="back"
        :is-loading="loading"
        @click="fetchBoard"
      />
    </div>

    <!-- Error state -->
    <Panel v-if="error">
      <div class="flex items-center gap-3 text-red-500">
        <Icon name="status-error" class="h-5 w-5" />
        <p>{{ error }}</p>
      </div>
    </Panel>

    <!-- Empty state -->
    <Panel v-else-if="!loading && !board?.rows.length">
      <div class="flex flex-col items-center gap-3 py-8 text-center">
        <Icon name="status-pending" class="text-wp-text-200 h-12 w-12" />
        <p class="text-wp-text-200">{{ $t('promotion.no_apps') }}</p>
      </div>
    </Panel>

    <!-- Board rows -->
    <div v-else class="flex flex-col gap-4">
      <div
        v-for="row in board?.rows"
        :key="row.app"
        class="rounded-xl border border-wp-background-400 bg-wp-background-100 p-4 shadow-sm"
      >
        <!-- App header -->
        <div class="mb-3 flex items-center gap-2">
          <span class="text-sm font-bold uppercase tracking-wide">{{ row.app }}</span>
          <span
            v-if="row.promotion?.status"
            class="rounded-full px-2 py-0.5 text-xs font-medium"
            :class="promotionBadgeClass(row.promotion.status)"
          >
            {{ row.promotion.status }}
          </span>
        </div>

        <!-- Stage flow -->
        <div class="overflow-x-auto pb-2">
          <PromotionRow
            :row="row"
            :deploying="deployingApp === row.app"
            @trigger="handleTrigger"
          />
        </div>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading && !board" class="flex flex-col gap-4">
        <div
          v-for="i in 4"
          :key="i"
          class="bg-wp-background-300 h-32 animate-pulse rounded-xl"
        />
      </div>
    </div>

    <!-- Deploy error toast -->
    <div
      v-if="deployError"
      class="bg-wp-error-100 fixed bottom-6 right-6 rounded-lg p-4 text-white shadow-lg"
    >
      <p class="font-semibold">Deploy failed</p>
      <p class="text-sm">{{ deployError }}</p>
    </div>
  </Container>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import Button from '~/components/atomic/Button.vue';
import Icon from '~/components/atomic/Icon.vue';
import Container from '~/components/layout/Container.vue';
import Panel from '~/components/layout/Panel.vue';
import PromotionRow from '~/components/promotion/PromotionRow.vue';
import { usePromotionBoard } from '~/compositions/usePromotionBoard';
import { requiredInject } from '~/compositions/useInjectProvide';
import type { Repo } from '~/lib/api/types';
import type { BoardRow } from '~/compositions/usePromotionBoard';

const repo = requiredInject('repo');

const { board, loading, error, fetchBoard, triggerPromotion, startAutoRefresh } = usePromotionBoard(
  (repo as unknown as { value: Repo }).value?.id,
);

const deployingApp = ref<string | null>(null);
const deployError = ref<string | null>(null);

async function handleTrigger(row: BoardRow) {
  deployingApp.value = row.app;
  deployError.value = null;
  try {
    await triggerPromotion({
      repoId: row.repoId,
      repoFullName: (repo as unknown as { value: Repo }).value?.full_name ?? '',
      pipelineNumber: row.build.pipelineNum,
      app: row.app,
      commitSha: row.commit.sha ?? '',
      commitMessage: row.commit.message,
      commitAuthor: row.commit.author,
      branch: row.build.steps[0]?.name ? row.commit.sha ?? 'main' : 'main',
    });
    await fetchBoard();
  } catch (err) {
    deployError.value = err instanceof Error ? err.message : String(err);
    setTimeout(() => { deployError.value = null; }, 5000);
  } finally {
    deployingApp.value = null;
  }
}

function promotionBadgeClass(status: string): string {
  const map: Record<string, string> = {
    deployed: 'bg-green-100 text-green-700',
    approved: 'bg-blue-100 text-blue-700',
    pending: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700',
    rejected: 'bg-red-100 text-red-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

onMounted(async () => {
  await fetchBoard();
  startAutoRefresh(15_000);
});
</script>
