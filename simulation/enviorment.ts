import { Assignment } from "../csp/csp.js";
import { CSPGraph, CSPVertex } from "../csp/structs.js";
import plan_day from "../dayplanner.js";
import Task, { ActivityType } from "../models/task.js";
import {
  DAY_END_TIME,
  DAY_START_TIME,
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
  isTimeInIntervall,
  isTimeInTask,
  MIN_BLOCK_LENGTH_IN_MIN,
  rescheudle,
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
import {
  cognitiveBlocksRewards,
  delayReward,
  energyReward,
  stressReward,
} from "./reward.js";

interface RewardWeights {
  structural: number;
  energy: number;
  stress: number;
  cognitive: number;
  delay: number;
}

enum EnvironmentError {
  COULD_NOT_DELAY_TASK,
  COULD_NOT_INSERT_GAP,
  COULD_NOT_FOCUS_TASK,
  COULD_NOT_PULL_TASK_EARLIER,
  COULD_NOT_SPLIT_TASK,
  BLOCK_TO_SMALL,
  COULD_NOT_RESCHEUDLE,
  NONE,
}

export default class Enviorment {
  public currentState: State = new State();
  public isStarted: boolean = false;
  public currentError: EnvironmentError = EnvironmentError.NONE;
  public currentStep = 0;
  public oldStep = 0;
  public rewardWeights: RewardWeights = {
    structural: 1.0,
    energy: 0.0,
    stress: 0.0,
    cognitive: 0.0,
    delay: 0.0,
  };

  constructor() {}

  resetWithFixedTasks(tasks: Assignment[]) {
    this.currentState = new State();
    this.currentError = EnvironmentError.NONE;

    this.currentState.scheudle = tasks;
    this.currentState.remaining_tasks = this.currentState.scheudle.length;

    this.isStarted = true;
  }

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

    let reward = this.computeReward(this.currentState, newState, action);
    this.currentState = newState;

    // console.log(
    //   "min",
    //   inMinutes(Timing.add(fromMinutes(newState.time), DAY_START_TIME)),
    //   inMinutes(newState.scheudle[newState.scheudle.length - 1].end),
    // );

    // if (
    //   inMinutes(Timing.add(fromMinutes(newState.time), DAY_START_TIME)) >=
    //   inMinutes(newState.scheudle[newState.scheudle.length - 1].end)
    // ) {
    // }

    const done =
      inMinutes(Timing.add(fromMinutes(newState.time), DAY_START_TIME)) >=
        inMinutes(newState.scheudle[newState.scheudle.length - 1].end) ||
      this.currentError != EnvironmentError.NONE;

    if (this.currentError != EnvironmentError.NONE) {
      this.oldStep = this.currentStep;
      this.currentStep = 0;
    }

    if (done && this.currentError == EnvironmentError.NONE) {
      //reward += 500;
      this.oldStep = this.currentStep;
      this.currentStep = 0;
    }

    if (this.currentError == EnvironmentError.NONE) {
      this.currentStep++;
    }

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

    reward =
      this.rewardWeights.cognitive *
      cognitiveBlocksRewards(reward, state, newState);

    reward = this.rewardWeights.energy * energyReward(reward, state, newState);

    reward = this.rewardWeights.stress * stressReward(reward, state, newState);

    // if (this.afterDeadline(next.scheudle)) {
    //   reward -= this.rewardWeights.structural * 10;
    // }

    if (this.currentError != EnvironmentError.NONE) {
      reward -= this.rewardWeights.structural * 0.007;
    } else {
      reward += this.rewardWeights.structural * 0.1;
    }

    //reward += (this.currentStep - this.oldStep) * 2;

    if (this.rewardWeights.delay > 0) {
      reward = this.rewardWeights.delay * delayReward(reward, state, newState);
    }

    //reward = Math.min(-300, Math.max(reward, 300));

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

  //sollte worken
  //TODO delay Task wenn id der jetzige Task -> dann splitte den task
  delayTask(id: string, state: State): State {
    const task = state.scheudle.find((e) => e.v.id == id);
    const currentMinute = Timing.add(fromMinutes(state.time), DAY_START_TIME);
    const scheudle = state.scheudle;

    if (!task) unreachable("!task");

    const posOfTask = state.scheudle.findIndex((e) => e.v.id == id);

    if (posOfTask < 0) unreachable("posOfTask < 0");

    const pauses = getPauseTime(state.scheudle);

    let fit = false;

    const { index, isPause } = findSlotByMinute(
      inMinutes(currentMinute),
      scheudle,
    );

    const isCurrentRunningTask = index == posOfTask && !isPause;

    for (let p = posOfTask + 1; p < pauses.length; p++) {
      const pause = pauses[p];
      if (inMinutes(task!.v.task.duration) <= inMinutes(pause)) {
        fit = true;
        //setze den Tasks möglich mittig!
        const taskBeforePause = state.scheudle[p];

        const pauseInMinutes = inMinutes(pause);
        const taskDurationInMinutes = inMinutes(task!.v.task.duration);

        const div = (pauseInMinutes - taskDurationInMinutes) / 2;

        const right = Math.floor(div);

        const newStart = Timing.add(fromMinutes(right), taskBeforePause.end);

        if (isCurrentRunningTask) {
          //splitte den Task! weil es ist der running Task
          const remainingDuration = Timing.diff(task!.end, currentMinute);
          const oldEnd = currentMinute;
          const oldDuration = Timing.diff(currentMinute, task!.start);
          const newEnd = Timing.add(newStart, remainingDuration);

          task!.end = oldEnd;
          task!.v.task.duration = oldDuration;

          const newTask = new Assignment(
            new CSPVertex(
              new Task({
                title: task!.v.task.title,
                duration: remainingDuration,
                activity: task!.v.task.activity,
                priority: task!.v.task.priority,
                deadline: task!.v.task.deadline,
              }),
            ),
            newStart,
          );

          newTask.end = newEnd;
          state.scheudle.push(newTask);
        } else {
          task!.start = newStart;
          task!.end = Timing.add(task!.start, task!.v.task.duration);
        }

        break;
      }
    }

    //checke ob du es ganz nach hinten packen kannst
    if (!fit) {
      this.currentError = EnvironmentError.COULD_NOT_DELAY_TASK;
    }

    return state;
  }

  //den jetzigen Task nen 3 min Break machen
  insertBreak(id: string, state: State): State {
    const scheudle = state.scheudle;
    const savedState = cloneState(state);

    const currentMinute = state.time;
    const currentTimeFromStart = Timing.add(
      DAY_START_TIME,
      fromMinutes(currentMinute),
    );
    const duration: Duration = new Duration({ hour: 0, minute: 3, second: 0 });

    const { index, isPause } = findSlotByMinute(currentMinute, scheudle);

    const task = state.scheudle[index];

    const pauses = getPauseTime(scheudle);

    let sumOfPauses = 0;

    pauses.forEach((v, i) => {
      if (i >= index) {
        sumOfPauses += inMinutes(v);
      }
    });

    //wenn keine pause da (freie zeit) wo ich nen gap hinzufügen kann
    if (sumOfPauses < inMinutes(duration)) {
      console.log("keine Pause!");
      this.currentError = EnvironmentError.COULD_NOT_INSERT_GAP;
      return state;
    }

    if (isPause) {
      console.log("pause");
      return state;
    }

    const remainingDuration = Timing.diff(task!.end, currentTimeFromStart);

    if (inMinutes(remainingDuration) < MIN_BLOCK_LENGTH_IN_MIN) {
      this.currentError = EnvironmentError.BLOCK_TO_SMALL;
      console.log("TOO SMALL");

      return state;
    }

    const oldEnd = currentTimeFromStart;
    const oldDuration = Timing.diff(currentTimeFromStart, task!.start);
    const newStart = Timing.add(currentTimeFromStart, duration); // hier gap hinzufügen
    const newEnd = Timing.add(newStart, remainingDuration);

    task!.end = oldEnd;
    task!.v.task.duration = oldDuration;

    const newTask = new Assignment(
      new CSPVertex(
        new Task({
          title: task!.v.task.title,
          duration: remainingDuration,
          activity: task!.v.task.activity,
          priority: task!.v.task.priority,
          deadline: task!.v.task.deadline,
        }),
      ),
      newStart,
    );

    newTask.end = newEnd;
    state.scheudle.push(newTask);
    state.scheudle = sortScheudle(state.scheudle);

    if (inMinutes(pauses[index]) < inMinutes(duration)) {
      //verschiebe alles um 3 min

      const newIndex = state.scheudle.findIndex((e) => e.v.id == newTask.v.id);
      const newStart = Timing.add(newTask.end, duration);

      const rescheudleSection = state.scheudle.splice(newIndex + 1);

      try {
        const rescheudlePlanSection = rescheudle(
          newStart,
          state,
          rescheudleSection,
        );

        if (rescheudlePlanSection.length == 0) {
          this.currentError = EnvironmentError.COULD_NOT_RESCHEUDLE;
          return savedState;
        }

        state.scheudle = state.scheudle.concat(rescheudlePlanSection);
      } catch (error) {
        console.log(error);
      }
    }

    return state;
  }

  //idee packe id an den laufende Time!
  //wenn es pause ist packe es rein
  //wenn gerade ein Task läuft splitte ihn und packe ihn an die focussedTask stelle!

  focusOnTask(id: string, state: State): State {
    const savedState = cloneState(state);

    let schedule = sortScheudle(state.scheudle);

    const taskIndex = schedule.findIndex((e) => e.v.task.id === id);
    if (taskIndex === -1) return savedState;

    const task = schedule[taskIndex];

    const now = Timing.add(fromMinutes(state.time), DAY_START_TIME);

    const { index: runningIndex, isPause } = findSlotByMinute(
      state.time,
      schedule,
    );

    const isRunningTask = runningIndex === taskIndex && !isPause;
    const isAlreadyRunned = isBefore(task.end, now);
    const isOnlyOneTask = schedule.length <= 1;

    if (isRunningTask || isAlreadyRunned || isOnlyOneTask) {
      this.currentError = EnvironmentError.COULD_NOT_FOCUS_TASK;
      return savedState;
    }

    if (!isPause && runningIndex >= 0) {
      const runningTask = schedule[runningIndex];

      if (isAfter(runningTask.end, now)) {
        const remaining = Timing.diff(runningTask.end, now);

        if (inMinutes(remaining) < MIN_BLOCK_LENGTH_IN_MIN) {
          this.currentError = EnvironmentError.BLOCK_TO_SMALL;
          return savedState;
        }

        // ersten Teil kürzen
        runningTask.end = now;
        runningTask.v.task.duration = Timing.diff(now, runningTask.start);

        // Rest-Block erzeugen
        const splitTask = new Assignment(
          new CSPVertex(
            new Task({
              title: runningTask.v.task.title,
              duration: remaining,
              activity: runningTask.v.task.activity,
              priority: runningTask.v.task.priority,
              deadline: runningTask.v.task.deadline,
            }),
          ),
          now,
        );

        splitTask.end = Timing.add(now, remaining);

        schedule.splice(runningIndex + 1, 0, splitTask);
      }
    }

    const updatedTaskIndex = schedule.findIndex((e) => e.v.task.id === id);

    const focusTask = schedule.splice(updatedTaskIndex, 1)[0];

    const insertIndex = runningIndex >= 0 ? runningIndex + 1 : 0;

    focusTask.start = now;
    focusTask.end = Timing.add(now, focusTask.v.task.duration);

    schedule.splice(insertIndex, 0, focusTask);

    const head = schedule.slice(0, insertIndex + 1);
    const tail = schedule.slice(insertIndex + 1);

    const rebuiltTail = rescheudle(focusTask.end, state, tail);

    if (!rebuiltTail || (rebuiltTail.length === 0 && tail.length > 0)) {
      this.currentError = EnvironmentError.COULD_NOT_RESCHEUDLE;
      return savedState;
    }

    state.scheudle = [...head, ...rebuiltTail];

    return state;
  }

  //pull task zu dem nächsten pause wo es fitted -> wenn die Pause innerhalb der jetzigen Zeit ist verwende nur jetzige Zeit bis pause ende
  pullTaskEarlier(id: string, state: State): State {
    const scheudle = state.scheudle;
    const task = scheudle.find((e) => e.v.id == id);
    const currentMinute = state.time;
    const currentMinuteFromStart = Timing.add(
      fromMinutes(currentMinute),
      DAY_START_TIME,
    );

    if (!task) unreachable("!task in pullTaskEarlier()");

    const duration = task!.v.task.duration;
    const indexOfTask = scheudle.findIndex((e) => e.v.id == id);

    if (indexOfTask < 0) unreachable("indexOfTask < 0 in pullTaskEarlier()");

    const { index, isPause } = findSlotByMinute(currentMinute, scheudle);

    if (index == indexOfTask && !isPause) {
      console.log("currently the Running Task!");
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
      const intervallStart = scheudle[fit].end;
      const intervallEnd = Timing.add(scheudle[fit].end, pauses[fit]);

      const currentlyInFittedPause = isTimeInIntervall(
        intervallStart,
        intervallEnd,
        currentMinuteFromStart,
      );

      if (
        currentlyInFittedPause &&
        inMinutes(Timing.diff(intervallEnd, currentMinuteFromStart)) <
          inMinutes(duration)
      ) {
        this.currentError = EnvironmentError.COULD_NOT_PULL_TASK_EARLIER;

        return state;
      } else {
        const pauseDur = currentlyInFittedPause
          ? Timing.diff(intervallEnd, currentMinuteFromStart)
          : pauses[fit];

        const taskBeforePause = state.scheudle[fit];
        const end = currentlyInFittedPause
          ? currentMinuteFromStart
          : taskBeforePause.end;

        const pauseInMinutes = inMinutes(pauseDur);
        const taskDurationInMinutes = inMinutes(duration);
        const div = (pauseInMinutes - taskDurationInMinutes) / 2;
        const right = Math.floor(div);

        const newStart = Timing.add(fromMinutes(right), end);

        task!.start = newStart;
        task!.end = Timing.add(newStart, duration);
      }
    } else {
      console.log("Could not found a pause!");
      this.currentError = EnvironmentError.COULD_NOT_PULL_TASK_EARLIER;
    }

    return state;
  }

  //wenn task != Running task ist, dann splitte in der Mitte suche danach eine Pause, die passt und packe es möglichst mittig in die Pause

  splitTask(id: string, state: State): State {
    const scheudle = state.scheudle;
    const currentMinute = state.time;
    const currentMinuteFromStart = Timing.add(
      DAY_START_TIME,
      fromMinutes(currentMinute),
    );
    const task = scheudle.find((e) => e.v.id == id);
    if (!task) unreachable("!task in splitTask()");

    if (isAfter(currentMinuteFromStart, task!.end)) {
      this.currentError = EnvironmentError.COULD_NOT_SPLIT_TASK;

      return state;
    }

    const duration = task!.v.task.duration;
    const { index, isPause } = findSlotByMinute(currentMinute, scheudle);

    //find next avaible pause
    let fit = -1;
    const pauses = getPauseTime(scheudle);
    const indexOfTask = scheudle.findIndex((e) => e.v.id == id);

    const isRunningTask = indexOfTask == index && !isPause;

    const oldEnd = Timing.add(
      task!.start,
      fromMinutes(Math.floor(inMinutes(duration) / 2)),
    );

    const remainingDuration = isRunningTask
      ? Timing.diff(task!.end, currentMinuteFromStart)
      : Timing.diff(task!.end, oldEnd);

    if (inMinutes(remainingDuration) < MIN_BLOCK_LENGTH_IN_MIN) {
      this.currentError = EnvironmentError.BLOCK_TO_SMALL;
      console.log("TOO SMALL");

      return state;
    }

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
      //versuche möglichst mittig in der Pause
      //splitte wenn möglich mittig

      const taskBeforePause = state.scheudle[fit];

      const pauseInMinutes = inMinutes(pauses[fit]);

      const taskDurationInMinutes = inMinutes(remainingDuration);

      const div = (pauseInMinutes - taskDurationInMinutes) / 2;

      const right = Math.floor(div);

      const newStart = Timing.add(fromMinutes(right), taskBeforePause.end);

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
        newStart,
      );

      newTask.end = Timing.add(newStart, remainingDuration);

      state.scheudle.push(newTask);
    }

    task!.end = isRunningTask ? currentMinuteFromStart : oldEnd;
    task!.v.task.duration = isRunningTask
      ? Timing.diff(currentMinuteFromStart, task!.start)
      : fromMinutes(Math.floor(inMinutes(duration)) / 2);

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
        console.log("DO NOTHING");
        break;

      default:
        unreachable("in applyAction()");
    }

    newState.scheudle = sortScheudle(newState.scheudle);

    //TEST

    //check for time overlow
    // const faultTask = newState.scheudle.find((e) => e.start.hour > 24);

    // if (faultTask) {
    //   console.log(state, faultTask);

    //   unreachable("Task sind einfach nach 0 Uhr!");
    // }

    //check ob es weniger task als vorher sind!
    if (state.scheudle.length > newState.scheudle.length) {
      console.log(state.scheudle);
      console.log(newState.scheudle);

      unreachable(
        "task sind verschwunden WTF! " +
          state.scheudle.length +
          ">" +
          newState.scheudle.length,
      );
    }

    //check ob es overlapp gibt
    if (this.hasOverlapp(newState.scheudle)) {
      unreachable("task hat overflow!");
    }

    return newState;
  }

  simulate(state: State): State {
    state = cloneState(state);
    //schreibe das um für pausen!
    const pauses = getPauseTime(state.scheudle);

    const time = Timing.add(DAY_START_TIME, fromMinutes(state.time));

    const end = state.isPause
      ? Timing.add(
          state.scheudle[state.current_task].end,
          pauses[state.current_task],
        )
      : state.scheudle[state.current_task].end;

    if (isAfter(time, end)) {
      //jetzt overrun

      state.delayInMinutes = Math.max(0, state.delayInMinutes - STEP_IN_MIN);
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
      const start = Timing.diff(time, state.scheudle[state.current_task].start);

      const minutesFocused = inMinutes(start);
      const prevMinutes = Math.max(0, minutesFocused - STEP_IN_MIN);

      const delta = energyLoss(minutesFocused) - energyLoss(prevMinutes);

      state.energy -= energyDeepWeight * energyMentalHealth * delta;
    } else {
      const minutesPaused = inMinutes(
        Timing.diff(time, state.scheudle[state.current_task].end),
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

      const deepWorkWeight = activity === ActivityType.DEEP_WORK ? 1.3 : 1;

      const mentalHealthWeight =
        activity === ActivityType.MENTAL_HEALTH ? -1.5 : 1;

      const taskPressure = Math.sqrt(state.remaining_tasks) * 0.1;

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

      const fatigueStress = (100 - state.energy) * 0.01;

      let deltaStress =
        deepWorkWeight * (taskPressure + deadlinePressure + fatigueStress);

      if (activity === ActivityType.MENTAL_HEALTH) {
        const relief = 0.5 + state.stress / 200;
        deltaStress -= relief;
      }

      state.stress += deltaStress;
    } else {
      const recovery = 0.3 + state.energy / 200;
      state.stress -= recovery;
    }

    state.stress = Math.max(0, Math.min(100, state.stress));

    if (isAfter(time, end) && state.delayInMinutes == 0) {
      const { index, isPause } = findSlotByMinute(state.time, state.scheudle);

      state.current_task = index;
      state.isPause = isPause;
      state.remaining_tasks = state.scheudle.length - 1 - state.current_task;

      let mu = 0.1;

      if (state.energy < 60) {
        mu += (60 - state.energy) / 150;
      }

      state.delayInMinutes = Math.floor(sampleLogNormal(mu, 1.4));
    }

    return state;
  }
}
