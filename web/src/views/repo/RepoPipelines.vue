<template>
  <div class="space-y-4">
    <div
      v-if="workflowTabs.length > 1"
      class="border-wp-background-400 dark:border-wp-background-100 bg-wp-background-200 flex flex-wrap gap-2 rounded-md border p-2"
    >
      <button
        v-for="tab in workflowTabs"
        :key="tab.value || 'all'"
        type="button"
        class="text-wp-text-100 hover:bg-wp-control-neutral-200 rounded-md px-3 py-2 text-sm transition-colors"
        :class="{ 'bg-wp-control-neutral-200 font-medium': selectedWorkflow === tab.value }"
        @click="selectedWorkflow = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <PipelineList
      :pipelines="filteredPipelines"
      :loading="pipelineStore.loading || hydratingWorkflows"
      :has-more="pipelineStore.hasMore"
      @load-more="loadMore"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import PipelineList from '~/components/repo/pipeline/PipelineList.vue';
import useApiClient from '~/compositions/useApiClient';
import { requiredInject } from '~/compositions/useInjectProvide';
import { useWPTitle } from '~/compositions/useWPTitle';
import { usePipelineStore } from '~/store/pipelines';

const repo = requiredInject('repo');
const pipelines = requiredInject('pipelines');
const pipelineStore = usePipelineStore();
const apiClient = useApiClient();
const route = useRoute();
const router = useRouter();

const page = ref(1);
const selectedWorkflow = ref(typeof route.query.app === 'string' ? route.query.app : '');
const hydratingWorkflows = ref(false);
const hydratedPipelineNumbers = new Set<number>();
// Seed from server-side distinct workflow names so all tabs are visible from the start
const seededWorkflowNames = ref<string[]>([]);

const workflowNames = computed(() => {
  const fromPipelines = pipelines.value.flatMap((pipeline) => pipeline.workflows?.map((workflow) => workflow.name) ?? []);
  return Array.from(new Set([...seededWorkflowNames.value, ...fromPipelines])).sort((a, b) => a.localeCompare(b));
});

const workflowTabs = computed(() => [
  { label: 'All', value: '' },
  ...workflowNames.value.map((workflow) => ({
    label: workflow,
    value: workflow,
  })),
]);

const filteredPipelines = computed(() => {
  if (!selectedWorkflow.value) {
    return pipelines.value;
  }

  return pipelines.value.filter((pipeline) =>
    pipeline.workflows?.some((workflow) => workflow.name === selectedWorkflow.value),
  );
});

watch(
  () => route.query.app,
  (queryApp) => {
    selectedWorkflow.value = typeof queryApp === 'string' ? queryApp : '';
  },
);

watch(selectedWorkflow, async (workflow) => {
  const query = { ...route.query };

  if (workflow) {
    query.app = workflow;
  } else {
    delete query.app;
  }

  await router.replace({ query });
});

watch(workflowNames, (names) => {
  if (selectedWorkflow.value && !names.includes(selectedWorkflow.value)) {
    selectedWorkflow.value = '';
  }
});

watch(
  pipelines,
  () => {
    void hydrateWorkflowMetadata();
  },
  { immediate: true },
);

async function hydrateWorkflowMetadata() {
  if (hydratingWorkflows.value) {
    return;
  }

  const missingPipelines = pipelines.value.filter(
    (pipeline) => (!pipeline.workflows || pipeline.workflows.length === 0) && !hydratedPipelineNumbers.has(pipeline.number),
  );

  if (missingPipelines.length === 0) {
    return;
  }

  hydratingWorkflows.value = true;

  await Promise.allSettled(
    missingPipelines.map(async (pipeline) => {
      hydratedPipelineNumbers.add(pipeline.number);
      pipelineStore.setPipeline(repo.value.id, await apiClient.getPipeline(repo.value.id, pipeline.number));
    }),
  );

  hydratingWorkflows.value = false;
}

async function loadMore() {
  page.value += 1;
  await pipelineStore.loadRepoPipelines(repo.value.id, page.value);
  await hydrateWorkflowMetadata();
}

onMounted(async () => {
  try {
    seededWorkflowNames.value = await apiClient.getRepoWorkflowNames(repo.value.id);
  } catch {
    // non-fatal: tabs will still populate from pipeline hydration
  }
});

const { t } = useI18n();
useWPTitle(computed(() => [t('repo.activity'), repo.value.full_name]));
</script>
