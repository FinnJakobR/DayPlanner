import {
  DAY_END_TIME,
  DAY_START_TIME,
  Duration,
  inMinutes,
  Time,
} from "../models/time.js";
import { MAX_TODOS } from "../util/utility.js";

import * as tf from "@tensorflow/tfjs-node";

export interface PolicyBuffer {
  state: number[];
  action: number[];
  reward: number;
  value: number;
  oldProbs: tf.Tensor;
  advantage: number;
}

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

export async function generateActionSpace() {
  let actionSpace: number[] = [];

  for (let i = 0; i < MAX_TODOS; i++) {
    let a: number[] = [];
    let action = ActionType.RESCHEUDLE_TASK;
    for (let x = inMinutes(DAY_START_TIME); x < inMinutes(DAY_END_TIME); x++) {
      a = a.concat([
        i / MAX_TODOS,
        action / ActionType.LENGTH,
        (x - inMinutes(DAY_START_TIME)) / inMinutes(DAY_END_TIME),
        0,
      ]);
    }
    actionSpace = actionSpace.concat(a);
  }

  for (let i = 0; i < MAX_TODOS; i++) {
    let a: number[] = [];
    let action = ActionType.CHANGE_DURATION;
    for (let x = inMinutes(DAY_START_TIME); x < inMinutes(DAY_END_TIME); x++) {
      a = a.concat([
        i / MAX_TODOS,
        action / ActionType.LENGTH,
        0,
        (x - inMinutes(DAY_START_TIME)) / inMinutes(DAY_END_TIME),
      ]);
    }
    actionSpace = actionSpace.concat(a);
  }

  for (let i = 0; i < MAX_TODOS; i++) {
    let a: number[] = [];
    let action = ActionType.RESCHEUDLE_TASK;
    for (let x = inMinutes(DAY_START_TIME); x < inMinutes(DAY_END_TIME); x++) {
      for (
        let z = inMinutes(DAY_START_TIME);
        z < inMinutes(DAY_END_TIME);
        z += 15
      ) {
        a = a.concat([
          i / MAX_TODOS,
          action / ActionType.LENGTH,
          (x - inMinutes(DAY_START_TIME)) / inMinutes(DAY_END_TIME),
          (z - inMinutes(DAY_START_TIME)) / inMinutes(DAY_END_TIME),
        ]);
      }
    }
    console.log(`Task ${i} ready!`);
    actionSpace = actionSpace.concat(a);
  }

  return actionSpace;
}
