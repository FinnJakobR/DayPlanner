import { Assignment } from "../csp/csp.js";
import { CSPGraph, CSPVertex } from "../csp/structs.js";
import plan_day from "../dayplanner.js";
import Task, { ActivityType } from "../models/task.js";
import {
  DAY_END_TIME,
  Duration,
  fit,
  fromMinutes,
  inMinutes,
  isAfter,
  isBefore,
  Time,
  Timing,
} from "../models/time.js";
import { FAKE_TASKS } from "../tests/fakeTasks.js";
import {
  cloneGenom,
  cloneState,
  energyLoss,
  findSlotByMinute,
  getRandomArrayIndex,
  getRandomInt,
  isSportActivity,
  sortScheudle,
  STEP_IN_MIN,
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
  COULD_NOT_INSERT_GAP,
  COULD_NOT_FOCUS_TASK,
  COULD_NOT_PULL_TASK_EARLIER,
  COULD_NOT_SPLIT_TASK,
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
    let newState = this.applyAction(this.currentState, action);
    newState = this.simulate(newState);
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
    let reward = 0;
    const prev = state;
    const next = newState;

    // ===== 1️⃣ Fortschritt belohnen =====
    const taskProgress = prev.remaining_tasks - next.remaining_tasks;

    reward += taskProgress * 20;

    // ===== 2️⃣ Energie stabil halten =====
    const deltaEnergy = next.energy - prev.energy;

    reward += deltaEnergy * 0.5;

    // ===== 3️⃣ Stress senken belohnen =====
    const deltaStress = prev.stress - next.stress;

    reward += deltaStress * 0.7;

    // ===== 4️⃣ Deadline-Verstoß stark bestrafen =====
    if (this.afterDeadline(next.scheudle)) {
      reward -= 25;
    }

    // ===== 5️⃣ Overlap bestrafen =====
    if (this.hasOverlapp(next.scheudle)) {
      reward -= 10;
    }

    if (this.currentError != EnvironmentError.NONE) {
      reward -= 15;
    }

    // ===== 6️⃣ Delay bestrafen =====
    const deltaDelay = next.delayInMinutes - prev.delayInMinutes;

    reward -= deltaDelay * 2;

    // ===== 7️⃣ Kleine Step-Kosten (Anti-Idle) =====
    reward -= 0.01;

    return Math.max(-50, Math.min(50, reward));
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

  insertBreak(id: string, state: State): State {
    const task = state.scheudle.find((e) => e.v.id == id);

    if (!task) unreachable("!task in InsertBreak()");

    const currentMinute = state.time;

    const duration: Duration = new Duration({ hour: 0, minute: 3, second: 0 });

    if (
      inMinutes(Timing.diff(DAY_END_TIME, fromMinutes(currentMinute))) <
      inMinutes(duration)
    ) {
      this.currentError = EnvironmentError.COULD_NOT_INSERT_GAP;
      return state;
    }

    const remainingTaskDuration = Timing.diff(
      task!.end,
      fromMinutes(currentMinute),
    );

    if (
      inMinutes(Timing.add(fromMinutes(currentMinute), duration)) +
        inMinutes(remainingTaskDuration) >
      inMinutes(DAY_END_TIME)
    ) {
      this.currentError = EnvironmentError.COULD_NOT_INSERT_GAP;
      return state;
    }

    task!.end = fromMinutes(currentMinute);
    task!.v.task.duration = Timing.add(task!.start, fromMinutes(currentMinute));

    const newTask = new Assignment(
      new CSPVertex(
        new Task({
          title: task!.v.task.title,
          duration: Timing.diff(task!.end, fromMinutes(currentMinute)),
          deadline: task!.v.task.deadline,
          priority: task!.v.task.priority,
          activity: task!.v.task.activity,
        }),
      ),
      Timing.add(fromMinutes(currentMinute), fromMinutes(1)),
    );

    newTask.end = Timing.add(newTask.start, newTask.v.task.duration);

    state.scheudle.push(newTask);

    return state;
  }

  focusOnTask(id: string, state: State): State {
    const task = state.scheudle.find((e) => e.v.task.id == id);
    const scheudle = state.scheudle;
    if (!task) unreachable("!task in focusOnTask()");

    const currentMinute = state.time;
    const duration = task!.v.task.duration;
    const taskStart = task!.start;

    const { index, isPause } = findSlotByMinute(currentMinute, scheudle);
    const pauses = getPauseTime(scheudle);

    if (isPause) {
      const isLongerThanPause =
        Timing.add(fromMinutes(currentMinute), duration) > pauses[index];

      if (isLongerThanPause) {
        const diff = Timing.diff(
          Timing.add(fromMinutes(currentMinute), duration),
          pauses[index],
        );

        //packe alle tasks dahinter
        scheudle
          .filter((e) => isAfter(e.start, taskStart))
          .forEach((e) => {
            e.start = Timing.add(e.start, diff);
            e.end = Timing.add(e.end, diff);
          });
      }
    } else {
      const runningTask = scheudle[index];
      const remainingDuration = Timing.diff(
        runningTask.v.task.duration,
        fromMinutes(currentMinute),
      );

      //wenn wir keine pause finde in der der splitted tasks passt hauen wir nen Error hinter
      if (
        !pauses.find(
          (e, i) => i > index && inMinutes(e) >= inMinutes(remainingDuration),
        )
      ) {
        this.currentError = EnvironmentError.COULD_NOT_FOCUS_TASK;
        return state;
      }

      const isLongerThanPause =
        inMinutes(Timing.add(remainingDuration, pauses[index])) <
        inMinutes(task!.v.task.duration);

      if (isLongerThanPause) {
        const diff = Timing.diff(
          task!.v.task.duration,
          Timing.add(remainingDuration, pauses[index]),
        );

        scheudle
          .filter((e) => isAfter(e.start, runningTask.start))
          .forEach((e) => {
            e.start = Timing.add(e.start, diff);
            e.end = Timing.add(e.end, diff);
          });
      }

      state = this.splitTask(runningTask.v.id, state);

      if (this.currentError == EnvironmentError.COULD_NOT_SPLIT_TASK) {
        this.currentError = EnvironmentError.COULD_NOT_FOCUS_TASK;
        return state;
      }
    }

    task!.start = fromMinutes(currentMinute);
    task!.end = Timing.add(task!.start, duration);
    return state;
  }

  pullTaskEarlier(id: string, state: State): State {
    const scheudle = state.scheudle;
    const task = scheudle.find((e) => e.v.id == id);
    const currentMinute = state.time;

    if (!task) unreachable("!task in pullTaskEarlier()");

    const duration = task!.v.task.duration;
    const indexOfTask = scheudle.findIndex((e) => e.v.id == id);

    if (indexOfTask < 0) unreachable("indexOfTask < 0 in pullTaskEarlier()");

    const { index } = findSlotByMinute(currentMinute, scheudle);

    if (index == indexOfTask) {
      this.currentError = EnvironmentError.COULD_NOT_PULL_TASK_EARLIER;
      return state;
    }

    const pauses = getPauseTime(scheudle);

    let fit = -1;

    for (let o = indexOfTask - 1; o >= 0; o--) {
      if (inMinutes(pauses[o]) >= inMinutes(duration)) {
        fit = o;
        break;
      }
    }

    if (fit > 0) {
      const start = scheudle[fit].end;
      task!.start = start;
      task!.end = Timing.add(start, duration);
    } else {
      this.currentError = EnvironmentError.COULD_NOT_PULL_TASK_EARLIER;
    }

    return state;
  }

  splitTask(id: string, state: State): State {
    const scheudle = state.scheudle;
    const currentMinute = state.time;
    const task = scheudle.find((e) => e.v.id == id);

    if (!task) unreachable("!task in splitTask()");

    const duration = task!.v.task.duration;

    //find next availbe pause
    let fit = -1;
    const pauses = getPauseTime(scheudle);
    const indexOfTask = scheudle.findIndex((e) => e.v.id == id);
    const remainingDuration = Timing.diff(duration, fromMinutes(currentMinute));

    for (let o = indexOfTask + 1; o < pauses.length; o++) {
      const currentPause = pauses[o];
      if (inMinutes(currentPause) >= inMinutes(remainingDuration)) {
        fit = o;
        break;
      }
    }

    if (fit < 0) {
      this.currentError = EnvironmentError.COULD_NOT_SPLIT_TASK;
      return state;
    } else {
      const start = scheudle[fit].end;

      const newTask = new Assignment(
        new CSPVertex(
          new Task({
            title: task!.v.task.title,
            duration: remainingDuration,
            priority: task!.v.task.priority,
            deadline: task!.v.task.deadline,
            activity: task!.v.task.activity,
          }),
        ),
        start,
      );

      newTask.end = Timing.add(start, remainingDuration);

      state.scheudle.push(newTask);
    }

    task!.end = fromMinutes(currentMinute);
    task!.v.task.duration = Timing.diff(
      fromMinutes(currentMinute),
      task!.start,
    );

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
        newState = this.focusOnTask(id, newState);
        break;

      case ActionType.INSERT_BREAK:
        newState = this.insertBreak(id, newState);
        break;

      case ActionType.PULL_TASK_EARLIER:
        newState = this.pullTaskEarlier(id, newState);
        break;

      case ActionType.SPLIT_TASK:
        newState = this.splitTask(id, newState);
        break;

      case ActionType.DO_NOTHING:
        break;

      default:
        unreachable("in applyAction()");
    }

    state.scheudle = sortScheudle(state.scheudle);

    return newState;
  }

  simulate(state: State): State {
    if (
      isAfter(state.scheudle[state.current_task].end, fromMinutes(state.time))
    ) {
      //jetzt overrun
      state.delayInMinutes -= Math.max(0, STEP_IN_MIN);
    }

    state.time += STEP_IN_MIN;

    const energyDeepWeight =
      state.scheudle[state.current_task].v.task.activity ==
      ActivityType.DEEP_WORK
        ? 1.2
        : 1;

    const energyMentalHealth =
      state.scheudle[state.current_task].v.task.activity ==
      ActivityType.MENTAL_HEALTH
        ? 0.5
        : 1;

    if (!state.isPause) {
      const start = Timing.diff(
        fromMinutes(state.time),
        state.scheudle[state.current_task].start,
      );

      const minutesFocused = inMinutes(start);
      const prevMinutes = Math.max(0, minutesFocused - STEP_IN_MIN);

      const delta = energyLoss(minutesFocused) - energyLoss(prevMinutes);

      state.energy -= energyDeepWeight * energyMentalHealth * delta;
    } else {
      const minutesPaused = inMinutes(
        Timing.diff(
          fromMinutes(state.time),
          state.scheudle[state.current_task].end,
        ),
      );

      const prevMinutes = Math.max(0, minutesPaused - STEP_IN_MIN);

      const deltaRecovery = Math.sqrt(minutesPaused) - Math.sqrt(prevMinutes);

      state.energy += 0.5 * deltaRecovery;
    }

    state.energy = Math.max(0, Math.min(100, state.energy));

    //calc stress
    if (!state.isPause) {
      const currentAssignment = state.scheudle[state.current_task];
      const activity = currentAssignment.v.task.activity;

      // ===== Activity Weights =====
      const deepWorkWeight = activity === ActivityType.DEEP_WORK ? 1.3 : 1;

      const mentalHealthWeight =
        activity === ActivityType.MENTAL_HEALTH ? -1.5 : 1;

      // ===== 1️⃣ Baseline Task Pressure =====
      const taskPressure = Math.sqrt(state.remaining_tasks) * 0.1;

      // ===== 2️⃣ Deadline Pressure =====
      let deadlinePressure = 0;
      const deadline = currentAssignment.v.task.deadline;

      if (!deadline.isDefaultTime()) {
        const minutesToDeadline = inMinutes(deadline) - state.time;

        if (minutesToDeadline > 0) {
          if (minutesToDeadline < 120) {
            deadlinePressure = Math.exp((120 - minutesToDeadline) / 40) * 0.02;
          }
        } else {
          deadlinePressure = 2.0;
        }
      }

      // ===== 3️⃣ Fatigue Stress =====
      const fatigueStress = (100 - state.energy) * 0.01;

      // ===== Gesamt =====
      let deltaStress =
        deepWorkWeight * (taskPressure + deadlinePressure + fatigueStress);

      // 💚 Mental Health reduziert Stress aktiv
      if (activity === ActivityType.MENTAL_HEALTH) {
        const relief = 0.5 + state.stress / 200;
        deltaStress -= relief;
      }

      state.stress += deltaStress;
    } else {
      // ===== Pause reduziert Stress =====
      const recovery = 0.3 + state.energy / 200;
      state.stress -= recovery;
    }

    state.stress = Math.max(0, Math.min(100, state.stress));

    if (
      isAfter(
        state.scheudle[state.current_task].end,
        fromMinutes(state.time),
      ) &&
      state.delayInMinutes == 0
    ) {
      const { index, isPause } = findSlotByMinute(state.time, state.scheudle);

      state.current_task = index;
      state.isPause = isPause;
      state.remaining_tasks = state.scheudle.length - state.current_task;

      let mu = 0.1;

      if (state.energy < 60) {
        mu += (60 - state.energy) / 150;
      }

      state.delayInMinutes = Math.floor(sampleLogNormal(mu, 0.25));
    }

    return state;
  }
}
