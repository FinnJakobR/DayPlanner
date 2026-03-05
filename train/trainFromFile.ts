import * as tf from "@tensorflow/tfjs-node";
import Enviorment from "../simulation/enviorment.js";
import { MAX_TODOS, readScheudleFromFile } from "../util/utility.js";
import { ActionType } from "../simulation/action.js";
import { appendFileSync, writeFileSync } from "node:fs";
import {
  actionToVector,
  stateToVector,
} from "../simulation/neuronalNetwork/preprocessing.js";
import Agent from "../simulation/agent.js";
import { inMinutes } from "../models/time.js";
import plan_day from "../dayplanner.js";
import Task, { ActivityType } from "../models/task.js";

// const GAMMA = 0.99;
// const CLIP_EPS = 0.2;
// const LEARNING_RATE = 3e-2;
const EPISODES = 10000;

export default async function trainModel() {
  const env = new Enviorment();
  const N = 15;
  const input_dim = 5 + MAX_TODOS * 7;
  const scheudle_path = "./scheudle.json";

  const generatedTask = readScheudleFromFile(scheudle_path);

  const agent = new Agent(ActivityType.LENGTH - 1, input_dim, "");

  let best_score = 0.0;
  let learn_iters = 0;
  let n_steps = 0;
  let score_history = [];
  let avg_score = 0;
  let i = 0;

  writeFileSync("./score.txt", "");

  for (let ep = 0; ep < EPISODES; ep++) {
    await env.resetWithFixedTasks(generatedTask);
    let state = env.currentState;

    let encodedState = stateToVector(state);

    console.log(encodedState.length);

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

      i++;

      done = res.done;
    }

    appendFileSync("./score.txt", `${avg_score} --> ${i} succesfull runs!\n`, {
      encoding: "utf-8",
    });

    i = 0;
    console.log("epsiode", ep);
    console.log("score", best_score);
    console.log("avg score", avg_score / 10000);
    console.log("time steps", n_steps);
    console.log("learning_steps", learn_iters);
  }
}
trainModel();
