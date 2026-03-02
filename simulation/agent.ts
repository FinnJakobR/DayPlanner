import Memory from "./neuronalNetwork/memory.js";
import { ActorNetwork, CriticNetwork } from "./neuronalNetwork/networks.js";
import * as tf from "@tensorflow/tfjs-node";
import State from "./state.js";
import { Action } from "./action.js";
import { MAX_TODOS } from "../util/utility.js";

export default class Agent {
  private actor: ActorNetwork;
  private critic: CriticNetwork;
  private critic_optimizer: tf.AdamOptimizer;
  private actor_optimizer: tf.AdamOptimizer;
  private gamma: number = 0.99;
  private learning_rate: number = 0.0003;
  private policy_clip: number = 0.2;
  private n_epochs: number = 10;
  private gae_lambda: number = 0.95;
  private batch_size: number = 64;
  private checkpoint_dir: string;
  private memory: Memory;
  private n_actions: number;

  constructor(n_actions: number, input_dim: number, checkpoint_dir: string) {
    this.actor = new ActorNetwork(input_dim, n_actions);
    this.critic = new CriticNetwork(input_dim);
    this.critic_optimizer = tf.train.adam(this.learning_rate);
    this.actor_optimizer = tf.train.adam(this.learning_rate);

    this.memory = new Memory(this.batch_size);
    this.checkpoint_dir = checkpoint_dir;
    this.n_actions = n_actions;
  }

  store(
    state: number[],
    action: number[],
    probability: number,
    critic_value: number,
    reward: number,
    done: boolean,
  ) {
    this.memory.store_memory(
      state,
      action,
      probability,
      critic_value,
      reward,
      done,
    );
  }

  async save_model() {
    console.log("saving_model");
    await this.actor.network.save(this.checkpoint_dir + "actor");
    await this.critic.network.save(this.checkpoint_dir + "critic");
  }

  async load_model() {
    console.log("load_model");
    this.actor.network = await tf.loadLayersModel(
      this.checkpoint_dir + "actor",
    );

    this.critic.network = await tf.loadLayersModel(
      this.checkpoint_dir + "critic",
    );
  }

  choose_action(state: tf.Tensor2D) {
    const logits = this.actor.forward(state);

    const actionLogits = logits[0].as1D();
    const idLogits = logits[1].as1D();

    const ids = tf.multinomial(idLogits, 1);
    const idlogProbs = tf.logSoftmax(idLogits);

    const actions = tf.multinomial(actionLogits, 1);
    const ActionlogProbs = tf.logSoftmax(actionLogits);

    const newActionLogProb = tf.sum(
      ActionlogProbs.mul(tf.oneHot(actions.squeeze(), this.n_actions)),
      1,
    );

    const newIdLogProb = tf.sum(
      idlogProbs.mul(tf.oneHot(ids.squeeze(), MAX_TODOS)),
      1,
    );

    const values = this.critic.forward(state) as tf.Tensor1D;

    const action = actions.dataSync()[0];
    const value = values.dataSync()[0];
    const log_prob = newActionLogProb.dataSync()[0];
    const id = ids.dataSync()[0];
    const idlog_prob = newIdLogProb.dataSync()[0];

    return {
      action: action,
      id: id,
      idlog_prob: idlog_prob,
      log_prob: log_prob,
      value: value,
    };
  }

  async learn() {
    for (let epoch = 0; epoch < this.n_epochs; epoch++) {
      // 1️⃣ Batches aus dem Memory generieren
      const {
        states,
        actions,
        probabilities,
        critic_values,
        rewards,
        dones,
        batches,
      } = this.memory.generate_batches();

      const values = critic_values.slice(); // Kopie der Critic Values

      // 2️⃣ Vorteil berechnen (GAE)
      const advantage = new Array(rewards.length).fill(0);

      for (let t = 0; t < rewards.length - 1; t++) {
        let discount = 1;
        let a_t = 0;
        for (let k = t; k < rewards.length - 1; k++) {
          a_t +=
            discount *
            (rewards[k] +
              this.gamma * values[k + 1] * (dones[k] ? 0 : 1) -
              values[k]);
          discount *= this.gamma * this.gae_lambda;
        }
        advantage[t] = a_t;
      }

      // 3️⃣ Für jeden Batch die Actor/Critic Updates
      for (const batch of batches) {
        tf.tidy(() => {
          const batchStates = tf.tensor2d(batch.map((i) => states[i])); // [batch, stateDim]
          const batchActions = tf.tensor2d(batch.map((i) => actions[i])); // [batch]

          const batchOldProbs = tf.tensor1d(batch.map((i) => probabilities[i])); // [batch]
          const batchAdvantage = tf.tensor1d(batch.map((i) => advantage[i])); // [batch]
          const batchReturns = tf.tensor1d(
            batch.map((i) => advantage[i] + values[i]),
          ); // [batch]

          // -------- Actor Loss --------
          this.actor_optimizer.minimize(() => {
            const logits = this.actor.forward(batchStates);

            const actionLogits = logits[0].as1D();
            const idLogits = logits[1].as1D();

            // log_prob berechnen
            const logProbs = tf.logSoftmax(actionLogits); // [batch, n_actions]
            const oneHotActions = tf.oneHot(batchActions, this.n_actions); // [batch, n_actions]
            const newLogProb = tf.sum(logProbs.mul(oneHotActions), 1); // [batch]

            const probRatio = tf.exp(newLogProb.sub(batchOldProbs)); // ratio = new/old
            const weightedProbs = probRatio.mul(batchAdvantage);

            const clippedRatio = tf.clipByValue(
              probRatio,
              1 - this.policy_clip,
              1 + this.policy_clip,
            );
            const weightedClipped = clippedRatio.mul(batchAdvantage);

            const actorLoss = tf
              .mean(tf.minimum(weightedProbs, weightedClipped).mul(-1))
              .asScalar();

            return actorLoss;
          });

          // -------- Critic Loss --------
          this.critic_optimizer.minimize(() => {
            const criticPred = this.critic.forward(batchStates) as tf.Tensor1D;
            const criticLoss = tf.losses.meanSquaredError(
              batchReturns,
              criticPred,
            );
            return criticLoss.asScalar();
          });
        });
      }
    }

    this.memory.clear_memory();
  }
}
