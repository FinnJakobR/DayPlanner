import * as tf from "@tensorflow/tfjs-node";
import ActorCritic from "./neuronalNetwork/neuronalNetwork.js";
import Enviorment from "./enviorment.js";
import { stateToVector } from "./neuronalNetwork/preprocessing.js";
import { fromMinutes } from "../models/time.js";
import { Action, ActionType } from "./action.js";
import { unreachable } from "../util/utility.js";
import { Assignment } from "../csp/csp.js";

const GAMMA = 0.99;
const CLIP_EPS = 0.2;
const LEARNING_RATE = 3e-2;
const EPISODES = 10000;

type StepBuffer = {
  state: number[];
  taskIndex: number;
  timeIndex: number;
  durationIndex: number;
  reward: number;
  value: number;
  logProb: number;
  advantage: number;
  return: number;
};

function sampleFromProbs(probs: number[]): number {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < probs.length; i++) {
    cum += probs[i];
    if (r < cum) return i;
  }
  return probs.length - 1;
}

function decodeAction(
  index: number,
  id: number,
  duration: number,
  time: number,
  scheudle: Assignment[],
): Action {
  switch (index) {
    case ActionType.RESCHEUDLE_TASK:
      return {
        type: ActionType.RESCHEUDLE_TASK,
        taskId: id < scheudle.length ? scheudle[id].v.id : "",
        time: fromMinutes(time),
      };
    case ActionType.CHANGE_DURATION:
      return {
        type: ActionType.CHANGE_DURATION,
        taskId: id < scheudle.length ? scheudle[id].v.id : "",
        duration: fromMinutes(duration),
      };
    case ActionType.SPLIT_TASK:
      return {
        type: ActionType.SPLIT_TASK,
        taskId: id < scheudle.length ? scheudle[id].v.id : "",
        time: fromMinutes(time),
        duration: fromMinutes(duration),
      };
    default:
      unreachable();
  }
  throw Error("unreachable!");
}

function maskTaskProbs(taskLogits: tf.Tensor, numTasks: number) {
  const x = taskLogits.shape[1];
  return tf.tidy(() => {
    const mask = tf.tensor1d(
      Array.from({ length: x! }, (_, i) => (i < numTasks ? 0 : -1e9)),
    );
    return taskLogits.add(mask);
  });
}

export default async function trainModel() {
  const env = new Enviorment();
  const agent = new ActorCritic(606, 3); // Multi-head version!
  const optimizer = tf.train.adam(LEARNING_RATE);

  for (let ep = 0; ep < EPISODES; ep++) {
    await env.reset();
    let state = env.currentState;
    let done = false;

    const buffer: StepBuffer[] = [];

    // ===== ROLLOUT =====
    while (!done) {
      const stateVec = tf.tensor2d([stateToVector(state)]);

      const { action, task, time, duration, value } = agent.forward(stateVec);

      const masked = maskTaskProbs(task, state.scheudle.length);

      const taskProbs = masked.softmax().dataSync();

      const timeProbs = time.dataSync();
      const durationProbs = duration.dataSync();
      const actionProbs = action.dataSync();

      const taskIndex = sampleFromProbs(Array.from(taskProbs));
      const timeIndex = sampleFromProbs(Array.from(timeProbs));
      const durationIndex = sampleFromProbs(Array.from(durationProbs));
      const actionType = sampleFromProbs(Array.from(actionProbs));

      const logProb =
        Math.log(taskProbs[taskIndex] + 1e-8) +
        Math.log(timeProbs[timeIndex] + 1e-8) +
        Math.log(durationProbs[durationIndex] + 1e-8);

      const a = decodeAction(
        actionType,
        taskIndex,
        timeIndex,
        durationIndex,
        state.scheudle,
      );

      const { nextState, reward, done: doneFlag } = env.step(a);

      buffer.push({
        state: stateToVector(state),
        taskIndex,
        timeIndex,
        durationIndex,
        reward,
        value: value.dataSync()[0],
        logProb,
        advantage: 0,
        return: 0,
      });

      state = nextState;
      done = doneFlag;

      stateVec.dispose();
      task.dispose();
      time.dispose();
      duration.dispose();
      value.dispose();
    }

    // ===== ADVANTAGE + RETURNS =====
    let G = 0;
    for (let t = buffer.length - 1; t >= 0; t--) {
      G = buffer[t].reward + GAMMA * G;
      buffer[t].return = G;
      buffer[t].advantage = G - buffer[t].value;
    }

    // ===== PPO UPDATE =====
    optimizer.minimize(() => {
      const policyLosses: tf.Tensor[] = [];
      const valueLosses: tf.Tensor[] = [];

      for (const b of buffer) {
        const stateTensor = tf.tensor2d([b.state]);
        const { task, time, duration, value } = agent.forward(stateTensor);

        const taskProb = task.squeeze().gather(b.taskIndex);
        const timeProb = time.squeeze().gather(b.timeIndex);
        const durationProb = duration.squeeze().gather(b.durationIndex);

        const newLogProb = taskProb
          .log()
          .add(timeProb.log())
          .add(durationProb.log());

        const ratio = newLogProb.sub(tf.scalar(b.logProb)).exp();

        const adv = tf.scalar(b.advantage);

        const clipped = tf.clipByValue(ratio, 1 - CLIP_EPS, 1 + CLIP_EPS);

        const policyLoss = tf.minimum(ratio.mul(adv), clipped.mul(adv)).mul(-1);

        const valueLoss = tf.losses.meanSquaredError(
          tf.scalar(b.return),
          value.squeeze(),
        );

        policyLosses.push(policyLoss);
        valueLosses.push(valueLoss);

        console.log("P", policyLoss.dataSync());

        stateTensor.dispose();
      }

      return tf.add(
        tf.stack(policyLosses).mean(),
        tf.stack(valueLosses).mean(),
      );
    });

    if (ep % 10 === 0) {
      console.log(`Episode ${ep} done`);
    }
  }
}

trainModel();
