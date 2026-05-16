<template>
  <Panel v-if="!loading">
    <form @submit.prevent="triggerManualPipeline">
      <span class="text-wp-text-100 text-xl">{{ $t('repo.manual_pipeline.title') }}</span>
      <InputField v-slot="{ id }" :label="$t('repo.manual_pipeline.select_branch')">
        <SelectField :id="id" v-model="payload.branch" :options="branches" required />
      </InputField>
      <InputField v-if="pipelineFileOptions.length > 1" v-slot="{ id }" :label="pipelineFileLabel">
        <SelectField :id="id" v-model="selectedPipelineFile" :options="pipelineFileOptions" required />
      </InputField>
      <InputField v-slot="{ id }" :label="$t('repo.manual_pipeline.variables.title')">
        <span class="text-wp-text-alt-100 mb-2 text-sm">{{ $t('repo.manual_pipeline.variables.desc') }}</span>
        <KeyValueEditor
          :id="id"
          v-model="payload.variables"
          :key-placeholder="$t('repo.manual_pipeline.variables.name')"
          :value-placeholder="$t('repo.manual_pipeline.variables.value')"
          :delete-title="$t('repo.manual_pipeline.variables.delete')"
          @update:is-valid="isVariablesValid = $event"
        />
      </InputField>
      <Button type="submit" :text="$t('repo.manual_pipeline.trigger')" :disabled="!isFormValid" />
    </form>
  </Panel>
  <div v-else class="text-wp-text-100 flex justify-center">
    <Icon name="spinner" />
  </div>
</template>

<script lang="ts" setup>
import { useNotification } from '@kyvg/vue3-notification';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import Button from '~/components/atomic/Button.vue';
import Icon from '~/components/atomic/Icon.vue';
import InputField from '~/components/form/InputField.vue';
import KeyValueEditor from '~/components/form/KeyValueEditor.vue';
import SelectField from '~/components/form/SelectField.vue';
import Panel from '~/components/layout/Panel.vue';
import useApiClient from '~/compositions/useApiClient';
import { requiredInject } from '~/compositions/useInjectProvide';
import { usePaginate } from '~/compositions/usePaginate';
import { useWPTitle } from '~/compositions/useWPTitle';
import { usePipelineStore } from '~/store/pipelines';

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
}>();

const apiClient = useApiClient();
const notifications = useNotification();
const i18n = useI18n();

const repo = requiredInject('repo');
const repoPermissions = requiredInject('repo-permissions');
const pipelines = requiredInject('pipelines');
const pipelineStore = usePipelineStore();

const route = useRoute();
const router = useRouter();
const branches = ref<{ text: string; value: string }[]>([]);
const payload = ref<{ branch: string; variables: Record<string, string> }>({
  branch: 'main',
  variables: {},
});
const selectedPipelineFile = ref('');
const loading = ref(true);
const hydratingWorkflows = ref(false);
const hydratedPipelineNumbers = new Set<number>();

const pipelineFileLabel = computed(() => 'Pipeline file');
const pipelineFileOptions = computed(() =>
  Array.from(new Set(pipelines.value.flatMap((pipeline) => pipeline.workflows?.map((workflow) => workflow.name) ?? [])))
    .sort((workflowA, workflowB) => workflowA.localeCompare(workflowB))
    .map((workflow) => ({
      text: workflow,
      value: workflow,
    })),
);

const isVariablesValid = ref(true);

const isFormValid = computed(() => {
  return payload.value.branch !== '' && isVariablesValid.value;
});

const pipelineOptions = computed(() => ({
  ...payload.value,
  variables: payload.value.variables,
}));

watch(
  pipelineFileOptions,
  (options) => {
    if (options.length === 0) {
      selectedPipelineFile.value = '';
      return;
    }

    const routeApp = typeof route.query.app === 'string' ? route.query.app : '';
    if (routeApp && options.some((option) => option.value === routeApp)) {
      selectedPipelineFile.value = routeApp;
      return;
    }

    if (!options.some((option) => option.value === selectedPipelineFile.value)) {
      selectedPipelineFile.value = options[0].value;
    }
  },
  { immediate: true },
);

watch(
  selectedPipelineFile,
  (pipelineFile) => {
    payload.value = {
      ...payload.value,
      variables: {
        ...payload.value.variables,
        ...(pipelineFile ? { APP: pipelineFile } : {}),
      },
    };

    if (!pipelineFile) {
      const { APP, ...variables } = payload.value.variables;
      payload.value = {
        ...payload.value,
        variables,
      };
    }
  },
  { immediate: true },
);

onMounted(async () => {
  if (!repoPermissions.value.push) {
    notifications.notify({ type: 'error', title: i18n.t('repo.settings.not_allowed') });
    await router.replace({ name: 'home' });
  }

  const data = await usePaginate((page) => apiClient.getRepoBranches(repo.value.id, { page }));
  branches.value = data.map((e) => ({
    text: e,
    value: e,
  }));

  await hydrateWorkflowMetadata();
  loading.value = false;
});

async function hydrateWorkflowMetadata() {
  if (hydratingWorkflows.value || pipelineFileOptions.value.length > 0) {
    return;
  }

  const missingPipelines = pipelines.value
    .filter((pipeline) => (!pipeline.workflows || pipeline.workflows.length === 0) && !hydratedPipelineNumbers.has(pipeline.number))
    .slice(0, 10);

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

async function triggerManualPipeline() {
  loading.value = true;
  const pipeline = await apiClient.createPipeline(repo.value.id, pipelineOptions.value);

  emit('close');

  if (typeof pipeline == 'string') {
    await router.push({
      name: 'repo',
      query: route.query,
    });

    notifications.notify({ type: 'warn', title: i18n.t('repo.manual_pipeline.no_manual_workflows') });
  } else {
    await router.push({
      name: 'repo-pipeline',
      params: {
        pipelineId: pipeline.number,
      },
    });
  }

  loading.value = false;
}

useWPTitle(computed(() => [i18n.t('repo.manual_pipeline.trigger'), repo.value.full_name]));
</script>
