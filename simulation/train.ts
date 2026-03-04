import * as tf from "@tensorflow/tfjs-node";
import Enviorment from "./enviorment.js";
import {
  actionToVector,
  stateToVector,
} from "./neuronalNetwork/preprocessing.js";
import {
  DAY_END_TIME,
  DAY_START_TIME,
  fromMinutes,
  inMinutes,
  Timing,
} from "../models/time.js";
import { Action, ActionType } from "./action.js";
import {
  getRandomArrayIndex,
  getRandomInt,
  getRandomTimeFromIntervall,
  MAX_TODOS,
  unreachable,
} from "../util/utility.js";
import { Assignment } from "../csp/csp.js";
import State from "./state.js";
import StepResult from "./step.js";
import { show } from "../util/debug.js";
import { getRandomTimeInTask } from "../tests/tests.js";

import Agent from "./agent.js";
import { ActivityType } from "../models/task.js";
import { appendFileSync, fsync, writeFileSync } from "fs";
import plan_day from "../dayplanner.js";

// const GAMMA = 0.99;
// const CLIP_EPS = 0.2;
// const LEARNING_RATE = 3e-2;
const EPISODES = 10000;

export default async function trainModel() {
  const env = new Enviorment();
  const N = 20;
  const input_dim = 5 + MAX_TODOS * 7;

  const generatedTask = await plan_day(env.generateTasks());

  const agent = new Agent(ActivityType.LENGTH - 1, input_dim, "");

  let best_score = 0.0;
  let learn_iters = 0;
  let n_steps = 0;
  let score_history = [];
  let avg_score = 0;

  writeFileSync("./score.txt", "");

  for (let ep = 0; ep < EPISODES; ep++) {
    await env.resetWithFixedTasks(generatedTask);
    console.log(generatedTask.length);
    let state = env.currentState;

    let encodedState = stateToVector(state);

    let done = false;
    let score = 0;

    while (!done) {
      const { action, id, idlog_prob, log_prob, value } = agent.choose_action(
        tf.tensor2d([encodedState]),
        state.scheudle,
      );

      const decodedId = state.scheudle[id].v.id;
      const res = env.step({ action: action, id: decodedId });
      const encodedAction = actionToVector(
        { action: action, id: decodedId },
        state.scheudle,
      );

      n_steps += 1;
      score += res.reward;
      agent.store(
        encodedState,
        encodedAction[0],
        idlog_prob + log_prob,
        value,
        res.reward,
        id,
        res.done,
      );

      if (n_steps % N == 0) {
        await agent.learn(res.nextState.scheudle.length);
        learn_iters += 1;
      }

      state = res.nextState;
      encodedState = stateToVector(state);
      score_history.push(score);
      avg_score = tf.mean(score_history.slice(-100)).dataSync()[0];

      if (avg_score > best_score) {
        best_score = avg_score;
        //save here
      }

      done = res.done;
    }

    appendFileSync("./score.txt", `${avg_score}\n`, { encoding: "utf-8" });

    console.log("epsiode", ep);
    console.log("score", best_score);
    console.log("avg score", avg_score);
    console.log("time steps", n_steps);
    console.log("learning_steps", learn_iters);
  }
}
trainModel();
