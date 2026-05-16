<template>
  <Container full-width class="md:min-h-xs flex grow-0 flex-col md:grow md:px-4">
    <div class="mb-4 flex justify-end">
      <div
        class="border-wp-background-400 dark:border-wp-background-100 bg-wp-background-200 inline-flex items-center rounded-md border p-1"
      >
        <button
          type="button"
          class="text-wp-text-100 hover:bg-wp-control-neutral-200 rounded-md p-2 transition-colors"
          :class="{ 'bg-wp-control-neutral-200': pipelineView === 'list' }"
          :title="listViewTitle"
          :aria-label="listViewTitle"
          @click="pipelineView = 'list'"
        >
          <Icon name="list-group" />
        </button>
        <button
          type="button"
          class="text-wp-text-100 hover:bg-wp-control-neutral-200 rounded-md p-2 transition-colors"
          :class="{ 'bg-wp-control-neutral-200': pipelineView === 'dag' }"
          :title="dagViewTitle"
          :aria-label="dagViewTitle"
          @click="pipelineView = 'dag'"
        >
          <Icon name="branch" />
        </button>
      </div>
    </div>

    <div class="flex min-h-0 w-full grow flex-wrap-reverse md:flex-nowrap md:gap-4">
      <PipelineStepList
        v-if="pipelineView === 'list'"
        v-model:selected-step-id="selectedStepId"
        :class="{ 'hidden md:flex': pipeline!.status === 'blocked' }"
        :pipeline="pipeline!"
      />
      <PipelineDAG
        v-else
        v-model:selected-step-id="selectedStepId"
        :class="{ 'hidden md:flex': pipeline!.status === 'blocked' }"
        :pipeline="pipeline!"
      />

      <div class="relative flex grow basis-full items-start justify-center md:basis-auto">
        <div v-if="pipeline!.errors?.some((e) => !e.is_warning)" class="mb-4 w-full md:mb-auto">
          <Panel>
            <div class="flex flex-col items-center gap-4 text-center">
              <Icon name="status-error" class="text-wp-error-100 h-16 w-16" size="1.5rem" />
              <span class="text-xl">{{ $t('repo.pipeline.we_got_some_errors') }}</span>
              <Button color="red" :text="$t('repo.pipeline.show_errors')" :to="{ name: 'repo-pipeline-errors' }" />
            </div>
          </Panel>
        </div>

        <div v-else-if="pipeline!.status === 'blocked'" class="mb-4 w-full md:mb-auto">
          <Panel>
            <div class="flex flex-col items-center gap-4">
              <Icon name="status-blocked" size="1.5rem" class="h-16 w-16" />
              <span class="text-xl">{{ $t('repo.pipeline.protected.awaits') }}</span>
              <div v-if="repoPermissions!.push" class="flex flex-wrap items-center justify-center gap-2">
                <Button
                  color="green"
                  :text="$t('repo.pipeline.protected.approve')"
                  :is-loading="isApprovingPipeline"
                  @click="approvePipeline"
                />
                <Button
                  color="red"
                  :text="$t('repo.pipeline.protected.decline')"
                  :is-loading="isDecliningPipeline"
                  @click="declinePipeline"
                />
              </div>
            </div>
          </Panel>
        </div>

        <div v-else-if="pipeline!.status === 'declined'" class="mb-4 w-full md:mb-auto">
          <Panel>
            <div class="flex flex-col items-center gap-4">
              <Icon name="status-declined" size="1.5rem" class="text-wp-error-100 h-16 w-16" />
              <p class="text-xl">{{ $t('repo.pipeline.protected.declined') }}</p>
            </div>
          </Panel>
        </div>

        <PipelineLog v-else-if="selectedStepId !== null" v-model:step-id="selectedStepId" :pipeline="pipeline!" />
      </div>
    </div>
  </Container>
</template>

<script lang="ts" setup>
import { computed, ref, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import Button from '~/components/atomic/Button.vue';
import Icon from '~/components/atomic/Icon.vue';
import Container from '~/components/layout/Container.vue';
import Panel from '~/components/layout/Panel.vue';
import PipelineDAG from '~/components/repo/pipeline/PipelineDAG.vue';
import PipelineLog from '~/components/repo/pipeline/PipelineLog.vue';
import PipelineStepList from '~/components/repo/pipeline/PipelineStepList.vue';
import useApiClient from '~/compositions/useApiClient';
import { useAsyncAction } from '~/compositions/useAsyncAction';
import { requiredInject } from '~/compositions/useInjectProvide';
import useNotifications from '~/compositions/useNotifications';
import { useWPTitle } from '~/compositions/useWPTitle';
import type { PipelineStep } from '~/lib/api/types';

const props = defineProps<{
  stepId?: string | null;
}>();

const apiClient = useApiClient();
const router = useRouter();
const route = useRoute();
const notifications = useNotifications();
const i18n = useI18n();

const pipeline = requiredInject('pipeline');
const repo = requiredInject('repo');
const repoPermissions = requiredInject('repo-permissions');

const stepId = toRef(props, 'stepId');
const pipelineView = ref<'list' | 'dag'>('list');
const listViewTitle = computed(() => 'List view');
const dagViewTitle = computed(() => 'DAG view');

const defaultStepId = computed(() => pipeline.value?.workflows?.[0].children?.[0].pid ?? null);

const selectedStepId = computed({
  get() {
    if (stepId.value !== '' && stepId.value !== null && stepId.value !== undefined) {
      const id = Number.parseInt(stepId.value, 10);

      let step = pipeline.value.workflows?.find((workflow) => workflow.pid === id)?.children[0];
      if (step) {
        return step.pid;
      }

      step = pipeline.value?.workflows?.reduce(
        (prev, p) => prev || p.children?.find((c) => c.pid === id),
        undefined as PipelineStep | undefined,
      );
      if (step) {
        return step.pid;
      }

      return defaultStepId.value;
    }

    if (window.innerWidth > 768) {
      return defaultStepId.value;
    }

    return null;
  },
  set(_selectedStepId: number | null) {
    if (_selectedStepId === null) {
      router.replace({ params: { ...route.params, stepId: '' } });
      return;
    }

    router.replace({ params: { ...route.params, stepId: `${_selectedStepId}` } });
  },
});

const { doSubmit: approvePipeline, isLoading: isApprovingPipeline } = useAsyncAction(async () => {
  await apiClient.approvePipeline(repo.value.id, `${pipeline.value.number}`);
  notifications.notify({ title: i18n.t('repo.pipeline.protected.approve_success'), type: 'success' });
});

const { doSubmit: declinePipeline, isLoading: isDecliningPipeline } = useAsyncAction(async () => {
  await apiClient.declinePipeline(repo.value.id, `${pipeline.value.number}`);
  notifications.notify({ title: i18n.t('repo.pipeline.protected.decline_success'), type: 'success' });
});

useWPTitle(
  computed(() => [
    i18n.t('repo.pipeline.tasks'),
    i18n.t('repo.pipeline.pipeline', { pipelineId: pipeline.value.number }),
    repo.value.full_name,
  ]),
);
</script>
