import { Assignment } from "../csp/csp";
import plan_day from "../dayplanner";
import Task, { ActivityType } from "../models/task";
import { Duration, Time } from "../models/time";
import { FAKE_TASKS } from "../tests/fakeTasks";
import {
  getRandomArrayIndex,
  getRandomInt,
  isSportActivity,
} from "../util/utility";
import {
  DeepFocusDayTemplate,
  NormalWeekDayTemplate,
  SemesterHolidayTemplate,
  WeekendDayTemplate,
} from "./daytemplates";
import State from "./state";

export default class Envoirment {
  public currentState: State = new State();
  public isStarted: boolean = false;
  public currentScheudle?: Assignment[];

  constructor() {}

  generateTasks(): Task[] {
    const templates = [
      new NormalWeekDayTemplate(),
      new SemesterHolidayTemplate(),
      new DeepFocusDayTemplate(),
      new WeekendDayTemplate(),
    ];

    const randomTemplate = getRandomArrayIndex(templates.length);

    return templates[randomTemplate].generate();
  }

  async start() {
    if (this.isStarted) {
      this.reset();
    }

    const tasks = this.generateTasks();
    this.currentScheudle = await plan_day(tasks);
    this.isStarted = true;
  }

  reset() {
    this.currentState = new State();
    this.isStarted = false;
    this.currentScheudle = undefined;
  }
}
