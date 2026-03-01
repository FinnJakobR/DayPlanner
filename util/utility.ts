import { Assignment, CSP } from "../csp/csp.js";
import { CSPVertex } from "../csp/structs.js";
import Genom, { TaskPriority } from "../models/genom.js";
import Task, { ActivityType } from "../models/task.js";
import {
  DAY_END_TIME,
  DAY_START_TIME,
  fromMinutes,
  inMinutes,
  inSeconds,
  isAfter,
  isBefore,
  Time,
  Timing,
} from "../models/time.js";
import State from "../simulation/state.js";

export const MAX_TODOS = 100;
export const STEP_IN_MIN = 5;

export function energyLoss(minutesFocused: number): number {
  const L = 20; // max loss
  const k = 0.05; // steepness
  const x0 = 60; // fatigue threshold

  return L / (1 + Math.exp(-k * (minutesFocused - x0)));
}

// find Task by Minute when in Task then !isPause when pause then index is the last task before the pause!
export function findSlotByMinute(minute: number, scheudle: Assignment[]) {
  const time = fromMinutes(minute);

  let i = 0;
  for (const a of scheudle) {
    if (isTimeInTask(time, a)) return { index: i, isPause: false };
  }

  for (const a of scheudle) {
    if (!isAfter(time, a.end)) break;
    i++;
  }

  return { index: i, isPause: true };
}

export function isTimeInTask(t: Time, slot: Assignment): boolean {
  return isAfter(t, slot.start) && isBefore(t, slot.end);
}

export function isSportActivity(activity: ActivityType): boolean {
  return (
    activity == ActivityType.INDOOR_SPORT ||
    activity == ActivityType.OUTDOOR_SPORT
  );
}

export function sortScheudle(scheudle: Assignment[]): Assignment[] {
  return scheudle.sort((a, b) => inSeconds(a.start) - inSeconds(b.start));
}

export async function decodeGenom(genome: Genom): Promise<Assignment[]> {
  const priorities: TaskPriority[] = [];

  for (const id of genome.priorities.keys()) {
    const priority = genome.priorities.get(id)!;

    priorities.push(priority);
  }

  const tasks = priorities
    .sort((a, b) => b.prority - a.prority)
    .map((e) => e.task);

  const csp = new CSP(tasks, genome);

  const a = await csp.run();

  a.sort((a, b) => inSeconds(a.start) - inSeconds(b.start)); // soritere nach anfangszeiten

  return a;
}

export function unreachable(message: string = "") {
  throw Error("UNREACHABLE: " + message);
}

export function calculateDomainLength() {
  return Timing.diff(DAY_END_TIME, DAY_START_TIME).hour * 60;
}

export function cloneGenom(g: Genom): Genom {
  const weights = { ...g.weights };

  const priorities = new Map(
    Array.from(g.priorities.entries()).map(([k, v]) => [k, { ...v }]),
  );

  const fitness = g.fitness;

  const newG = new Genom([]);

  newG.weights = weights;
  newG.fitness = fitness;
  newG.priorities = priorities;

  return newG;
}

export function cloneTime(t: Time): Time {
  return new Time({ hour: t.hour, minute: t.minute, second: t.second });
}

export function cloneState(s: State): State {
  const newState = new State();

  newState.current_task = s.current_task;
  newState.delayInMinutes = s.delayInMinutes;
  newState.energy = s.energy;
  newState.remaining_tasks = s.remaining_tasks;
  newState.stress = s.stress;

  newState.nextDeadlineInMinutes = s.nextDeadlineInMinutes;

  newState.scheudle = s.scheudle.map((a) => {
    const newTask = new Task({
      title: a.v.task.title,
      duration: cloneTime(a.v.task.duration),
      deadline: cloneTime(a.v.task.deadline),
      priority: a.v.task.priority,
      activity: a.v.task.activity,
    });

    newTask.id = a.v.task.id; // WICHTIG: alte ID übernehmen

    const newAssignment = new Assignment(new CSPVertex(newTask), a.start);
    newAssignment.end = a.end;

    return newAssignment;
  });

  return newState;
}

export function cappedDiff(a: number, b: number, alpha: number) {
  return Math.max(a - b, alpha);
}

export function getDurationSum(tasks: Task[]): Time {
  let sum = new Time({ hour: 0, minute: 0, second: 0 });

  for (const task of tasks) {
    sum = Timing.add(sum, task.duration);
  }

  return sum;
}

export function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRandomArrayIndex(length: number): number {
  return getRandomInt(0, length - 1);
}

export function getRandomTimeFromIntervall(start: Time, end: Time): Time {
  const start_hour = start.hour;
  const end_hour = end.hour;

  const random_hour = getRandomInt(start_hour, end_hour);

  let random_minute = 0;
  let random_second = 0;

  if (end_hour == random_hour) {
    random_minute = getRandomInt(0, end.minute);
    random_second = getRandomInt(0, end.second);
  } else if (start_hour == random_hour) {
    random_minute = getRandomInt(start.minute, 59);
    random_second = getRandomInt(end.second, 59);
  } else {
    random_minute = getRandomInt(0, 59);
    random_second = getRandomInt(0, 59);
  }

  return new Time({
    hour: random_hour,
    minute: random_minute,
    second: random_second,
  });
}

export function prettyPrintTime(time: Time): string {
  return `${time.hour}H - ${time.minute}M - ${time.second}s`;
}

export function prettyPrintTask(task: Task): void {
  console.log(`---${task.title}---`);
  console.log("Duration:", prettyPrintTime(task.duration));
  console.log("Deadline:", prettyPrintTime(task.deadline));
  console.log("Priority:", task.priority);
  console.log("");
}

export function prettyPrintTasks(tasks: Task[]): void {
  for (const task of tasks) {
    prettyPrintTask(task);
  }
}
