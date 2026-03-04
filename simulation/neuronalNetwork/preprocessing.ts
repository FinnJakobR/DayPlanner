import State from "../state.js";
import { MAX_PRIORITY, MAX_TODOS } from "../../util/utility.js";
import { Assignment } from "../../csp/csp.js";
import { DAY_END_TIME, inMinutes } from "../../models/time.js";
import { ActivityType } from "../../models/task.js";
import { Action } from "../action.js";

export function actionToVector(
  action: Action,
  scheudle: Assignment[],
): number[] {
  return [action.action, scheudle.findIndex((e) => e.v.id == action.id)];
}

export function scheudleToVector(schedule: Assignment[]): number[] {
  const vec: number[] = [];

  for (let t = 0; t < MAX_TODOS; t++) {
    const assignment = schedule[t];

    if (assignment) {
      vec.push(
        inMinutes(assignment.start) / 1024,
        inMinutes(assignment.end) / 1024,
        t / MAX_TODOS,
        assignment.v.task.activity / ActivityType.LENGTH,
        !assignment.v.task.deadline.isDefaultTime()
          ? inMinutes(assignment.v.task.deadline) / 1024
          : 0,
        inMinutes(assignment.v.task.duration) / 1024,
        assignment.v.task.priority / MAX_PRIORITY,
      );
    } else {
      vec.push(0, 0, 0, 0, 0, 0, 0);
    }
  }

  return vec;
}

export function stateToVector(state: State): number[] {
  const vector: number[] = [
    state.current_task / MAX_TODOS,
    state.delayInMinutes / 1024,
    state.energy / 100,
    state.remaining_tasks / MAX_TODOS,
    state.stress / 100,
    ...scheudleToVector(state.scheudle),
  ];

  return vector;
}
