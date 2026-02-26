import * as lognormal from "@stdlib/stats-base-dists-lognormal";
import AC3 from "../csp/ac3";
import { Assignment } from "../csp/csp";
import { CSPGraph, CSPVertex } from "../csp/structs";
import plan_day from "../dayplanner";
import Task, { ActivityType } from "../models/task";
import { Duration, inMinutes, isBefore, Time, Timing } from "../models/time";
import { FAKE_TASKS } from "../tests/fakeTasks";
import {
  cloneGenom,
  getRandomArrayIndex,
  getRandomInt,
  isSportActivity,
  unreachable,
} from "../util/utility";
import { Action, ActionType } from "./action";
import {
  DeepFocusDayTemplate,
  NormalWeekDayTemplate,
  SemesterHolidayTemplate,
  WeekendDayTemplate,
} from "./daytemplates";
import State from "./state";
import StepResult from "./step";
import { sampleLogNormal } from "../util/math";

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

    if (rand < 0.71) {
      return templates[0].generate();
    } else if (rand < 0.28) {
      return templates[1].generate();
    } else if (rand < 0.2) {
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
    this.isStarted = true;
  }

  reset() {
    this.currentState = new State();
    this.isStarted = false;
    this.start();
  }

  step(action: Action): StepResult {
    const newState = this.applyAction(this.currentState, action);
    const reward = this.computeReward(this.currentState, newState);
    const done = true; //this.checkDone(newState);
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

  computeReward(state: State, newState: State): number {
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

    return reward;
  }

  rescheudleTasks(id: string, time: Time, state: State): State {
    const task = state.scheudle.find((a) => a.v.id == id);

    if (!task) unreachable();

    task!.start = time;
    task!.end = Time.add(time, task!.v.task.duration);

    return state;
  }

  changeDuration(id: string, duration: Duration, state: State): State {
    const task = state.scheudle.find((a) => a.v.id == id);

    if (!task) unreachable();

    task!.v.task.duration = duration;

    task!.end = Timing.add(task!.start, duration);

    return state;
  }

  splitTasks(id: string, duration: Duration, time: Time, state: State): State {
    const a = state.scheudle.find((a) => a.v.id == id)!;
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
    return state;
  }

  nextTask(state: State) {
    if (state.remaining_tasks > 0) {
      state.remaining_tasks--;
      state.current_task++;
    }

    return state;
  }

  generateOverrun(state: State): State {
    const t = state.scheudle[state.current_task].v.task;

    const randomDelay = inMinutes(t.duration) * sampleLogNormal(0, 0.25);

    state.delayInMinutes = randomDelay;

    return state;
  }

  applyAction(state: State, action: Action): State {
    let newState = new State();
    switch (action.type) {
      case ActionType.RESCHEUDLE_TASK:
        const rescheudle_id = action.taskId;
        const rescheudle_time = action.time;
        newState = this.rescheudleTasks(rescheudle_id, rescheudle_time, state);
        break;

      case ActionType.CHANGE_DURATION:
        const break_duration = action.duration;
        const change_duration_id = action.taskId;

        newState = this.changeDuration(
          change_duration_id,
          break_duration,
          state,
        );
        break;

      case ActionType.SPLIT_TASK:
        const split_id = action.taskId;
        const split_time = action.time;
        const split_duration = action.duration;
        newState = this.splitTasks(split_id, split_duration, split_time, state);
        break;

      default:
        unreachable();
    }

    newState = this.nextTask(newState);
    newState = this.generateOverrun(newState);

    //next Deadlines usw!
    //insert Pauses!

    return newState;
  }
}
