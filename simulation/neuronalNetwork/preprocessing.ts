import State from "../state.js";
import { MAX_TODOS } from "../../util/utility.js";
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

export function stateToVector(state: State): number[] {
  const vector: number[] = [
    state.current_task / MAX_TODOS,
    state.delayInMinutes / inMinutes(DAY_END_TIME),
    state.energy / 100,
    state.nextDeadlineInMinutes / inMinutes(DAY_END_TIME),
    state.remaining_tasks / MAX_TODOS,
    state.stress / 100,
  ];

  return vector;
}
