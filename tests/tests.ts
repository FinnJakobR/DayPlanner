import { Assignment } from "../csp/csp.js";
import plan_day from "../dayplanner.js";
import {
  DAY_END_TIME,
  DAY_START_TIME,
  inMinutes,
  Timing,
} from "../models/time.js";
import { show } from "../util/debug.js";
import { getRandomInt } from "../util/utility.js";
import { generateFakeTasks } from "./fakeTasks.js";

export async function generateRandomDayPlan(
  num_of_tasks: number,
): Promise<Assignment[]> {
  const tasks = generateFakeTasks(num_of_tasks);
  const scheudle = await plan_day(tasks);
  show(scheudle);

  return scheudle;
}

export function getRandomTimeInTask(
  index: number,
  scheudle: Assignment[],
): number {
  let t = 0;

  const testedVertex = scheudle[index];
  t =
    inMinutes(Timing.diff(testedVertex.start, DAY_START_TIME)) +
    getRandomInt(0, inMinutes(testedVertex.v.task.duration) - 3);

  return t;
}

//generateRandomDayPlan(10);
