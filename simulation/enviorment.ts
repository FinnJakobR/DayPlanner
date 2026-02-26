import { Assignment } from "../csp/csp.js";
import { CSPGraph, CSPVertex } from "../csp/structs.js";
import plan_day from "../dayplanner.js";
import Task, { ActivityType } from "../models/task.js";
import {
  Duration,
  fromMinutes,
  inMinutes,
  isBefore,
  Time,
  Timing,
} from "../models/time.js";
import { FAKE_TASKS } from "../tests/fakeTasks.js";
import {
  cloneGenom,
  cloneState,
  getRandomArrayIndex,
  getRandomInt,
  isSportActivity,
  sortScheudle,
  unreachable,
} from "../util/utility.js";
import { Action, ActionType } from "./action.js";
import {
  DeepFocusDayTemplate,
  NormalWeekDayTemplate,
  SemesterHolidayTemplate,
  WeekendDayTemplate,
} from "./daytemplates.js";
import State from "./state.js";
import StepResult from "./step.js";
import { sampleLogNormal } from "../util/math.js";
import { stat } from "node:fs";

export default class Enviorment {
  public currentState: State = new State();
  public isStarted: boolean = false;

  constructor() {}

  generateTasks(): Task[] {
    const templates = [
      new NormalWeekDayTemplate(),
      new WeekendDayTemplate(),
      new DeepFocusDayTemplate(),
      new SemesterHolidayTemplate(),
    ];

    const rand = Math.random();

    if (rand < 0.7) {
      return templates[0].generate();
    } else if (rand < 0.85) {
      return templates[1].generate();
    } else if (rand < 0.95) {
      return templates[2].generate();
    } else {
      return templates[3].generate();
    }
  }

  async start() {
    if (this.isStarted) {
      this.reset();
    }

    const tasks = this.generateTasks();
    this.currentState.scheudle = await plan_day(tasks);
    this.currentState.remaining_tasks = this.currentState.scheudle.length;

    this.isStarted = true;
  }

  async reset() {
    this.currentState = new State();
    this.isStarted = false;
    await this.start();
  }

  step(action: Action): StepResult {
    const newState = this.applyAction(this.currentState, action);
    const reward = this.computeReward(this.currentState, newState, action);
    console.log(reward, action);
    const done = newState.remaining_tasks == 0; //this.checkDone(newState);
    this.currentState = newState;

    return { nextState: newState, reward, done };
  }

  hasOverlapp(scheudle: Assignment[]): boolean {
    for (let i = 0; i < scheudle.length; i++) {
      for (let j = i + 1; j < scheudle.length; j++) {
        if (
          scheudle[i].start < scheudle[j].end &&
          scheudle[j].start < scheudle[i].end
        ) {
          return true;
        }
      }
    }

    return false;
  }

  afterDeadline(scheudle: Assignment[]): boolean {
    for (const a of scheudle) {
      if (a.v.task.deadline.isDefaultTime()) continue;

      if (!isBefore(a.end, a.v.task.deadline)) return true;
    }

    return false;
  }

  computeReward(state: State, newState: State, action: Action): number {
    let reward = 0.0;

    const tasks = newState.scheudle.map((e) => e.v.task);

    //check if Overlap

    const scheudle = newState.scheudle;

    if (this.hasOverlapp(scheudle)) reward -= 5;

    if (this.afterDeadline(scheudle)) reward -= 14;

    const deltaStress = newState.stress - state.stress;
    const deltaEnergy = newState.energy - state.energy;

    reward += deltaStress * 2.0;
    reward += deltaEnergy * 1.0;

    const tasksProgress = state.remaining_tasks - newState.remaining_tasks;
    reward += tasksProgress * 10;

    const deltaDelay = newState.delayInMinutes - state.delayInMinutes;
    reward -= deltaDelay * 5;

    reward -= 0.01;

    if (action.taskId.length == 0) reward -= 15;

    reward = Math.max(-50, Math.min(50, reward));

    return reward;
  }

  rescheudleTasks(id: string, time: Time, state: State) {
    const task = state.scheudle.find((a) => a.v.id == id);

    if (!task) unreachable();

    task!.start = time;
    task!.end = Time.add(time, task!.v.task.duration);
  }

  changeDuration(id: string, duration: Duration, state: State) {
    const task = state.scheudle.find((a) => a.v.id == id);

    if (!task) unreachable();

    task!.v.task.duration = duration;

    task!.end = Timing.add(task!.start, duration);
  }

  splitTasks(id: string, duration: Duration, time: Time, state: State) {
    const a = state.scheudle.find((a) => a.v.id == id)!;

    if (!a) unreachable();

    const task = a.v.task;

    const newTask = new Task({
      title: task.title,
      duration: Timing.diff(task.duration, duration),
      deadline: task.deadline,
      priority: task.priority,
      activity: task.activity,
    });

    task.duration = duration;
    a.end = Timing.add(a.start, duration);

    const newA = new Assignment(new CSPVertex(newTask), time);
    state.scheudle.push(newA);
  }

  nextTask(state: State) {
    if (state.remaining_tasks > 0) {
      state.remaining_tasks--;
      state.current_task++;
    }

    return state;
  }

  generateOverrun(t: Timing): number {
    const randomDelay = inMinutes(t) * sampleLogNormal(0, 0.1);

    return randomDelay;
  }

  //get Deadlines in Minutes
  getNextDeadline(scheudle: Assignment[], current_task_index: number): number {
    let deadline: number = 0;

    for (let i = current_task_index; i < scheudle.length; i++) {
      const currentTask = scheudle[i];
      const hasDeadline = !currentTask.v.task.deadline.isDefaultTime();
      if (hasDeadline) {
        const currentDeadline = currentTask.v.task.deadline;
        deadline = inMinutes(currentDeadline);
      }
    }
    return deadline;
  }

  applyAction(state: State, action: Action): State {
    let newState = cloneState(state);

    if (action.taskId.length != 0) {
      switch (action.type) {
        case ActionType.RESCHEUDLE_TASK:
          const rescheudle_id = action.taskId;
          const rescheudle_time = action.time;

          this.rescheudleTasks(rescheudle_id, rescheudle_time, newState);
          break;

        case ActionType.CHANGE_DURATION:
          const break_duration = action.duration;
          const change_duration_id = action.taskId;

          this.changeDuration(change_duration_id, break_duration, newState);
          break;

        case ActionType.SPLIT_TASK:
          const split_id = action.taskId;
          const split_time = action.time;
          const split_duration = action.duration;

          this.splitTasks(split_id, split_duration, split_time, newState);
          break;

        default:
          unreachable();
      }
    }

    newState.scheudle = sortScheudle(newState.scheudle);

    let taskBefore = newState.current_task;
    newState = this.nextTask(newState);

    if (newState.remaining_tasks == 0) return newState;

    let currentTask = newState.current_task;

    const t0 = newState.scheudle[taskBefore];
    const t1 = newState.scheudle[currentTask];

    const pause = Timing.diff(t1.start, t0.end);
    const pauseInMinutes = this.generateOverrun(pause);

    newState.energy += Math.min(100, 0.001 * pauseInMinutes);
    newState.stress -= Math.min(100, 0.001 * pauseInMinutes);

    const delayInMinutes = this.generateOverrun(t1.v.task.duration);

    newState.delayInMinutes = delayInMinutes;
    newState.stress += Math.min(100, 0.001 * delayInMinutes);

    newState.nextDeadlineInMinutes = this.getNextDeadline(
      newState.scheudle,
      newState.current_task,
    );

    return newState;
  }
}
