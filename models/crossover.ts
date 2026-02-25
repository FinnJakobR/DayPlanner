import Genom, { MetaWeights, TaskPriority } from "./genom.js";

export default function crossover(dad: Genom, mom: Genom): Genom {
  const w_gap_crossover_weight = Math.random();
  const w_late_crossover_weight = Math.random();
  const w_priority_crossover_weight = Math.random();

  const childWeights: MetaWeights = {
    w_gap:
      dad.weights.w_gap * w_gap_crossover_weight +
      (1 - w_gap_crossover_weight) * mom.weights.w_gap,
    w_late:
      dad.weights.w_late * w_late_crossover_weight +
      (1 - w_late_crossover_weight) * mom.weights.w_late,
    w_priority:
      dad.weights.w_priority * w_priority_crossover_weight +
      (1 - w_priority_crossover_weight) * mom.weights.w_priority,
  };

  const tasksOrder = new Map<string, TaskPriority>();

  for (const id of dad.priorities.keys()) {
    if (Math.random() > 0.5) {
      tasksOrder.set(id, dad.priorities.get(id)!);
    } else {
      tasksOrder.set(id, mom.priorities.get(id)!);
    }
  }

  let child = new Genom([]);

  child.priorities = tasksOrder;
  child.weights = childWeights;

  return child;
}
