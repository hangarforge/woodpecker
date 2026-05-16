<template>
  <div class="text-wp-text-100 flex w-full flex-col gap-2 pb-2 md:w-5/12 md:min-w-sm md:max-w-xl">
    <Panel v-if="!hasWorkflows">
      <span>{{ $t('repo.pipeline.no_pipeline_steps') }}</span>
    </Panel>

    <div
      v-else
      class="border-wp-background-400 dark:border-wp-background-100 bg-wp-background-200 h-[500px] overflow-hidden rounded-md border"
    >
      <VueFlow
        v-model:nodes="flowNodes"
        :edges="flowEdges"
        :node-types="nodeTypes"
        class="bg-wp-background-100"
        :nodes-draggable="false"
        :nodes-connectable="false"
        :elements-selectable="true"
        :zoom-on-double-click="false"
        :min-zoom="0.2"
        :max-zoom="2"
        @node-click="handleNodeClick"
      >
        <Background color="var(--wp-color-background-400)" :gap="20" :size="1" variant="dots" />
        <Controls position="top-right" />

        <template #node-workflow-group="{ data }">
          <div
            class="border-wp-background-400 dark:border-wp-background-100 bg-wp-background-100 text-wp-text-100 flex h-full w-full items-start gap-2 rounded-md border border-dashed px-3 py-2"
          >
            <PipelineStatusIcon :status="data.status" class="h-4! w-4! shrink-0" />
            <span class="truncate text-sm font-semibold">{{ data.label }}</span>
          </div>
        </template>
      </VueFlow>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, markRaw, nextTick, ref, watch } from 'vue';

import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import type { Edge, Node } from '@vue-flow/core';

import Panel from '~/components/layout/Panel.vue';
import PipelineStatusIcon from '~/components/repo/pipeline/PipelineStatusIcon.vue';
import type { Pipeline, PipelineStatus, PipelineStep } from '~/lib/api/types';

import StepNode from './StepNode.vue';

interface StepNodeData {
  step: PipelineStep;
  selected: boolean;
}

interface WorkflowNodeData {
  label: string;
  status: PipelineStatus;
}

const props = defineProps<{
  pipeline: Pipeline;
  selectedStepId: number | null;
}>();

const emit = defineEmits<{
  (event: 'update:selected-step-id', selectedStepId: number): void;
}>();

const WORKFLOW_WIDTH = 280;
const WORKFLOW_GAP = 48;
const WORKFLOW_PADDING_X = 18;
const WORKFLOW_PADDING_Y = 18;
const WORKFLOW_HEADER_HEIGHT = 52;
const STEP_HEIGHT = 52;
const STEP_GAP = 16;

const nodeTypes = {
  step: markRaw(StepNode),
};

const flowNodes = ref<Node[]>([]);
const flowEdges = ref<Edge[]>([]);

const hasWorkflows = computed(() => (props.pipeline.workflows?.length ?? 0) > 0);

const dagGraph = computed(() => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  props.pipeline.workflows?.forEach((workflow, workflowIndex) => {
    const workflowNodeId = `workflow-${workflow.pid}`;
    const workflowHeight = Math.max(
      WORKFLOW_HEADER_HEIGHT + WORKFLOW_PADDING_Y * 2,
      WORKFLOW_HEADER_HEIGHT + workflow.children.length * (STEP_HEIGHT + STEP_GAP) + WORKFLOW_PADDING_Y,
    );

    nodes.push({
      id: workflowNodeId,
      type: 'workflow-group',
      position: {
        x: workflowIndex * (WORKFLOW_WIDTH + WORKFLOW_GAP),
        y: 0,
      },
      data: {
        label: workflow.name,
        status: workflow.state,
      } satisfies WorkflowNodeData,
      draggable: false,
      selectable: false,
      connectable: false,
      style: {
        width: `${WORKFLOW_WIDTH}px`,
        height: `${workflowHeight}px`,
      },
    });

    workflow.children.forEach((step, stepIndex) => {
      nodes.push({
        id: `step-${step.pid}`,
        type: 'step',
        parentNode: workflowNodeId,
        extent: 'parent',
        position: {
          x: WORKFLOW_PADDING_X,
          y: WORKFLOW_HEADER_HEIGHT + stepIndex * (STEP_HEIGHT + STEP_GAP),
        },
        data: {
          step,
          selected: step.pid === props.selectedStepId,
        } satisfies StepNodeData,
        draggable: false,
        connectable: false,
        selectable: true,
        style: {
          width: `${WORKFLOW_WIDTH - WORKFLOW_PADDING_X * 2}px`,
        },
      });

      if (stepIndex > 0) {
        const previousStep = workflow.children[stepIndex - 1];
        edges.push({
          id: `edge-${previousStep.pid}-${step.pid}`,
          source: `step-${previousStep.pid}`,
          target: `step-${step.pid}`,
          style: {
            stroke: 'var(--wp-color-background-400)',
            strokeWidth: 2,
          },
        });
      }
    });
  });

  return { nodes, edges };
});

const { fitView, onPaneReady } = useVueFlow();

watch(
  dagGraph,
  async (graph) => {
    flowNodes.value = graph.nodes;
    flowEdges.value = graph.edges;

    await nextTick();

    if (graph.nodes.length > 0) {
      void fitView({ padding: 0.2, duration: 200 });
    }
  },
  { immediate: true },
);

onPaneReady((instance) => {
  if (flowNodes.value.length > 0) {
    instance.fitView({ padding: 0.2 });
  }
});

function handleNodeClick({ node }: { node: Node }) {
  const step = (node.data as StepNodeData | undefined)?.step;
  if (step) {
    emit('update:selected-step-id', step.pid);
  }
}
</script>
