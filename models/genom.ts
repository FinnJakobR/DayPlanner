import { calculateDomainLength } from "../util/utility.js";
import Task from "./task.js";

export interface TaskPriority {
  task: Task;
  prority: number;
  slotIndex: number;
}

export interface MetaWeights {
  w_gap: number;
  w_priority: number;
  w_late: number;
}

//genom beinhaltet die Task Priorites und die meta Weights (das was gelernt wird!)
export default class Genom {
  public priorities: Map<string, TaskPriority>;
  public weights: MetaWeights;
  public fitness: number = 0.0;

  constructor(tasks: Task[]) {
    this.priorities = new Map<string, TaskPriority>();
    this.weights = {
      w_gap: Math.random(),
      w_priority: Math.random(),
      w_late: Math.random(),
    };

    this.normalizeWeights();
    this.initProperties(tasks);
  }

  initProperties(tasks: Task[]) {
    for (const t of tasks) {
      this.priorities.set(t.id, {
        task: t,
        prority: Math.random(),
        slotIndex: Math.floor(Math.random() * calculateDomainLength()),
      });
    }
  }

  getWeightSum(): number {
    let sum = 0.0;

    for (const w in this.weights) {
      switch (w) {
        case "w_gap":
          sum += this.weights.w_gap;
          break;

        case "w_priority":
          sum += this.weights.w_priority;
          break;

        case "w_late":
          sum += this.weights.w_late;
          break;

        default:
          throw Error("unreachable");
      }
    }

    return sum;
  }

  normalizeWeights() {
    const total = this.getWeightSum();
    for (const w in this.weights) {
      switch (w) {
        case "w_gap":
          this.weights.w_gap /= total;
          break;

        case "w_priority":
          this.weights.w_priority /= total;
          break;

        case "w_late":
          this.weights.w_late /= total;
          break;

        default:
          throw Error("unreachable");
      }
    }
  }
}
