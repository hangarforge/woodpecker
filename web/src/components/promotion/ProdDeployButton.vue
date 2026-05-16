<template>
  <!-- 
    Single-click "Deploy to Prod" button.
    Shown on pipeline detail page when the deploy-test step has succeeded.
    Admin: fires immediately. Non-admin: creates an approval request.
  -->
  <div v-if="showButton" class="mt-4">
    <Panel>
      <div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="font-semibold">{{ $t('promotion.ready_for_prod') }}</p>
          <p class="text-wp-text-200 text-sm">{{ $t('promotion.deploy_test_passed') }}</p>
        </div>

        <div class="flex items-center gap-3">
          <!-- Pending approval badge -->
          <div v-if="promotionStatus === 'pending'" class="flex items-center gap-2 text-amber-500">
            <Icon name="status-blocked" class="h-5 w-5" />
            <span class="text-sm font-medium">{{ $t('promotion.awaiting_approval') }}</span>
          </div>

          <!-- Deploying badge -->
          <div v-else-if="promotionStatus === 'approved'" class="flex items-center gap-2 text-blue-500">
            <Icon name="status-running" class="h-5 w-5 animate-spin" />
            <span class="text-sm font-medium">{{ $t('promotion.deploying') }}</span>
          </div>

          <!-- Deployed badge -->
          <div v-else-if="promotionStatus === 'deployed'" class="flex items-center gap-2 text-green-500">
            <Icon name="status-success" class="h-5 w-5" />
            <span class="text-sm font-medium">{{ $t('promotion.deployed') }}</span>
          </div>

          <!-- Failed badge -->
          <div v-else-if="promotionStatus === 'failed' || promotionStatus === 'rejected'" class="flex items-center gap-2 text-red-500">
            <Icon name="status-error" class="h-5 w-5" />
            <span class="text-sm font-medium">{{ $t(`promotion.${promotionStatus}`) }}</span>
          </div>

          <!-- Deploy button (idle) -->
          <Button
            v-if="!promotionStatus || promotionStatus === 'failed' || promotionStatus === 'rejected'"
            color="green"
            :text="$t('promotion.deploy_to_prod')"
            start-icon="push"
            :is-loading="deploying"
            @click="handleDeploy"
          />
        </div>
      </div>

      <!-- Error message -->
      <p v-if="deployError" class="mt-2 text-sm text-red-500">{{ deployError }}</p>
    </Panel>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted } from 'vue';
import Button from '~/components/atomic/Button.vue';
import Icon from '~/components/atomic/Icon.vue';
import Panel from '~/components/layout/Panel.vue';
import { usePromotionBoard } from '~/compositions/usePromotionBoard';
import type { Pipeline } from '~/lib/api/types';

const props = defineProps<{
  pipeline: Pipeline;
  repoId: number;
  repoFullName: string;
}>();

const { triggerPromotion } = usePromotionBoard(props.repoId);

const deploying = ref(false);
const deployError = ref<string | null>(null);
const promotionStatus = ref<string | null>(null);

// Show button only when deploy-test step succeeded
const showButton = computed(() => {
  if (!props.pipeline.workflows) return false;
  return props.pipeline.workflows.some((wf) =>
    wf.children.some((step) => step.name === 'deploy-test' && step.state === 'success'),
  );
});

async function handleDeploy() {
  deploying.value = true;
  deployError.value = null;
  try {
    const result = await triggerPromotion({
      repoId: props.repoId,
      repoFullName: props.repoFullName,
      pipelineNumber: props.pipeline.number,
      app: props.pipeline.workflows?.[0]?.name ?? '',
      commitSha: props.pipeline.commit,
      commitMessage: props.pipeline.message,
      commitAuthor: props.pipeline.author,
      branch: props.pipeline.branch,
    });
    promotionStatus.value = result.status;
  } catch (err) {
    deployError.value = err instanceof Error ? err.message : String(err);
  } finally {
    deploying.value = false;
  }
}

onMounted(async () => {
  // Check if a promotion already exists for this pipeline
  const token = localStorage.getItem('hfci-jwt') ?? '';
  const apiBase = import.meta.env.VITE_HFCI_API_URL ?? `${window.location.protocol}//${window.location.host.replace('woodpecker', 'hfci-api')}`;
  try {
    const res = await fetch(
      `${apiBase}/api/promotions?repoFullName=${encodeURIComponent(props.repoFullName)}&app=${encodeURIComponent(props.pipeline.workflows?.[0]?.name ?? '')}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok) {
      const promotions: { testPipelineNum: number; status: string }[] = await res.json();
      const existing = promotions.find((p) => p.testPipelineNum === props.pipeline.number);
      if (existing) {
        promotionStatus.value = existing.status;
      }
    }
  } catch { /* non-fatal */ }
});
</script>
