import { Assignment } from "../csp/csp.js";
import plan_day from "../dayplanner.js";
import { show } from "../util/debug.js";
import { generateFakeTasks } from "./fakeTasks.js";

export async function generateRandomDayPlan(
  num_of_tasks: number,
): Promise<Assignment[]> {
  const tasks = generateFakeTasks(num_of_tasks);
  const scheudle = await plan_day(tasks);
  show(scheudle);

  return scheudle;
}

generateRandomDayPlan(10);
