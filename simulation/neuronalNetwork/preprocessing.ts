import State from "../state.js";
import { MAX_TODOS } from "../../util/utility.js";
import { Assignment } from "../../csp/csp.js";
import { DAY_END_TIME, inMinutes } from "../../models/time.js";
import { ActivityType } from "../../models/task.js";

export function scheudleToVector(scheudle: Assignment[]): number[] {
  let vector: number[] = [];

  const padLength = MAX_TODOS - scheudle.length;
  let i = 0;

  for (const a of scheudle) {
    vector = vector.concat([
      inMinutes(a.start) / inMinutes(DAY_END_TIME),
      inMinutes(a.end) / inMinutes(DAY_END_TIME),
      a.v.task.priority / 100,
      a.v.task.deadline.isDefaultTime()
        ? 0
        : inMinutes(a.v.task.deadline) / inMinutes(DAY_END_TIME),
      a.v.task.activity / ActivityType.LENGTH,
      i / scheudle.length, // decode id
    ]);

    i++;
  }

  return vector.concat(
    new Array((padLength * vector.length) / scheudle.length).fill(0),
  );
}

export function stateToVector(state: State): number[] {
  const vector: number[] = [
    state.current_task / MAX_TODOS,
    state.delayInMinutes / inMinutes(DAY_END_TIME),
    state.energy / 100,
    state.nextDeadlineInMinutes / inMinutes(DAY_END_TIME),
    state.remaining_tasks / MAX_TODOS,
    state.stress / 100,
    ...scheudleToVector(state.scheudle),
  ];

  return vector;
}
