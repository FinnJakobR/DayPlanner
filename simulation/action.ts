import { Duration, Time } from "../models/time";

export enum ActionType {
  RESCHEUDLE_TASK,
  SPLIT_TASK,
  CHANGE_DURATION,
  LENGTH,
}

export type Action =
  | { type: ActionType.RESCHEUDLE_TASK; taskId: string; time: Time }
  | {
      type: ActionType.SPLIT_TASK;
      taskId: string;
      time: Time;
      duration: Duration;
    }
  | { type: ActionType.CHANGE_DURATION; taskId: string; duration: Duration };
