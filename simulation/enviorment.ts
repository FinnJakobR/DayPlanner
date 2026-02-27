import { Assignment } from "../csp/csp.js";
import { CSPGraph, CSPVertex } from "../csp/structs.js";
import plan_day from "../dayplanner.js";
import Task, { ActivityType } from "../models/task.js";
import {
  Duration,
  fit,
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
import { getPauseTime } from "../models/fitness.js";

enum EnvironmentError {
  COULD_NOT_DELAY_TASK,

  NONE,
}

export default class Enviorment {
  public currentState: State = new State();
  public isStarted: boolean = false;
  public currentError: EnvironmentError = EnvironmentError.NONE;

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
    this.currentError = EnvironmentError.NONE;

    await this.start();
  }

  step(action: Action): StepResult {
    const newState = this.applyAction(this.currentState, action);
    const reward = this.computeReward(this.currentState, newState, action);
    const done = newState.remaining_tasks == 0; //this.checkDone(newState);
    this.currentState = newState;
    this.currentError = EnvironmentError.NONE;

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

  delayTask(id: string, state: State): State {
    const task = state.scheudle.find((e) => e.v.id == id);

    if (!task) unreachable("!task");

    const posOfTask = state.scheudle.findIndex((e) => e.v.id == id);

    if (posOfTask < 0) unreachable("posOfTask < 0");

    const pauses = getPauseTime(state.scheudle);

    let fit = false;

    for (let p = posOfTask; p < pauses.length; p++) {
      const pause = pauses[p];
      if (task!.v.task.duration <= pause) {
        fit = true;
        //setze den Tasks möglich mittig!

        const taskBeforePause = state.scheudle[p];

        const pauseInMinutes = inMinutes(pause);
        const taskDurationInMinutes = inMinutes(task!.v.task.duration);

        const div = pauseInMinutes / taskDurationInMinutes;

        const right = Math.floor(div);

        const newStart = Timing.add(fromMinutes(right), taskBeforePause.end);

        task!.start = newStart;
        task!.end = Timing.add(task!.start, task!.v.task.duration);
      }
    }

    if (!fit) this.currentError = EnvironmentError.COULD_NOT_DELAY_TASK;

    return state;
  }

  applyAction(state: State, action: Action): State {
    let newState = cloneState(state);

    const id = action.id;

    switch (action.action) {
      case ActionType.DELAY_TASK:
        newState = this.delayTask(id, newState);
        break;

      case ActionType.FOCUS_ON_TASK:
        break;

      case ActionType.INSERT_BREAK:
        //Zb wenn die overrun sehr hoch ist einfach mal abschalten und durchatmen
        break;

      case ActionType.PULL_TASK_EARLIER:
        //zb. wenn stress sehr oben unten dann mache was für mental Health
        break;

      case ActionType.REDUCE_SCOPE:
        break;

      case ActionType.SPLIT_TASK:
        break;

      default:
        unreachable("in applyAction()");
    }

    return newState;
  }
}
