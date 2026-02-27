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
  FOCUS_ON_TASK,
  DELAY_TASK,
  SPLIT_TASK,
  INSERT_BREAK,
  PULL_TASK_EARLIER,
  REDUCE_SCOPE,
  DO_NOTHING,
  LENGTH,
}

export type Action = { action: ActionType; id: string };
