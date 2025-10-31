import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

export interface AutoLayoutOptions {
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  nodeWidth?: number;
  nodeHeight?: number;
  horizontalSpacing?: number;
  verticalSpacing?: number;
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: AutoLayoutOptions = {}
) {
  const {
    direction = 'TB',
    nodeWidth = 240,
    nodeHeight = 110,
    horizontalSpacing = 300,
    verticalSpacing = 150,
  } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: horizontalSpacing,
    ranksep: verticalSpacing,
  });

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { 
      width: nodeWidth, 
      height: nodeHeight 
    });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Apply calculated positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export function createHierarchicalLayout(
  nodes: Node[],
  edges: Edge[],
  options: AutoLayoutOptions = {}
) {
  // Filter edges to only include parent-child relationships
  const hierarchicalEdges = edges.filter(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    // Only include edges that represent actual hierarchy
    // Objective -> Key Result, Key Result -> Initiative, Objective -> Objective (parent-child)
    return (
      (sourceNode?.type === 'objective' && targetNode?.type === 'keyResult') ||
      (sourceNode?.type === 'keyResult' && targetNode?.type === 'initiative') ||
      (sourceNode?.type === 'objective' && targetNode?.type === 'objective')
    );
  });

  return getLayoutedElements(nodes, hierarchicalEdges, options);
}

export function getDefaultNodePosition(
  nodeType: string,
  index: number,
  parentIndex?: number
): { x: number; y: number } {
  const baseX = 100;
  const baseY = 100;
  const horizontalSpacing = 300;
  const verticalSpacing = 150;

  switch (nodeType) {
    case 'objective':
      return {
        x: baseX + index * horizontalSpacing,
        y: baseY,
      };
    case 'keyResult':
      return {
        x: baseX + (parentIndex || 0) * horizontalSpacing + (index * 200),
        y: baseY + verticalSpacing,
      };
    case 'initiative':
      return {
        x: baseX + (parentIndex || 0) * horizontalSpacing + (index * 200),
        y: baseY + verticalSpacing * 2,
      };
    default:
      return {
        x: baseX + index * horizontalSpacing,
        y: baseY + index * verticalSpacing,
      };
  }
}



