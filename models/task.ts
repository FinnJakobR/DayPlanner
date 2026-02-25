import { Duration, inSeconds, Time } from "./time.js";

import { randomUUID } from "crypto";

export function sumDurations(tasks: Task[]): number {
  return tasks.reduce((sum, t) => sum + inSeconds(t.duration), 0);
}

export enum ActivityType {
  NONE = 0,
  OUTDOOR_SPORT,
  INDOOR_SPORT,
  DEEP_WORK,
  MENTAL_HEALTH,
  LENGTH,
}

export default class Task {
  public title: string;
  public duration: Duration;
  public deadline: Time;
  public priority: number;
  public id: string = randomUUID();
  public activity: ActivityType = ActivityType.NONE;

  constructor({
    title,
    duration,
    deadline = new Time({ hour: Infinity, minute: Infinity, second: Infinity }),
    priority = Infinity,
    activity = ActivityType.NONE,
  }: {
    title: string;
    duration: Duration;
    deadline: Time;
    priority: number;
    activity: ActivityType;
  }) {
    this.title = title;
    this.duration = duration;
    this.deadline = deadline;
    this.priority = priority;
    this.activity = activity;
  }
}
