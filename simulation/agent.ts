import Memory from "./neuronalNetwork/memory.js";
import { ActorNetwork, CriticNetwork } from "./neuronalNetwork/networks.js";
import * as tf from "@tensorflow/tfjs-node";
import State from "./state.js";
import { Action, ActionType } from "./action.js";
import { MAX_TODOS } from "../util/utility.js";
import { Assignment } from "../csp/csp.js";

export default class Agent {
  private actor: ActorNetwork;
  private critic: CriticNetwork;
  private critic_optimizer: tf.AdamOptimizer;
  private actor_optimizer: tf.AdamOptimizer;
  private gamma: number = 0.99;
  private learning_rate: number = 1e-4; // 1e-3
  private policy_clip: number = 0.2;
  private n_epochs: number = 40;
  private gae_lambda: number = 0.5;
  private batch_size: number = 2048;
  private entropy: number = 0.01; // 0.00054;
  private checkpoint_dir: string;
  private memory: Memory;
  private n_actions: number;

  constructor(
    n_actions: number,
    input_dim: number,
    checkpoint_dir: string,
    n_steps: number,
  ) {
    this.actor = new ActorNetwork(input_dim, n_actions);
    this.critic = new CriticNetwork(input_dim);
    this.critic_optimizer = tf.train.adam(this.learning_rate);
    this.actor_optimizer = tf.train.adam(this.learning_rate);
    this.batch_size = n_steps;

    this.memory = new Memory(this.batch_size);
    this.checkpoint_dir = checkpoint_dir;
    this.n_actions = n_actions;
  }

  store(
    state: number[],
    action: number,
    probability: number,
    critic_value: number,
    reward: number,
    id: number,
    done: boolean,
  ) {
    this.memory.store_memory(
      state,
      action,
      probability,
      critic_value,
      reward,
      id,
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
      this.checkpoint_dir + "actor/model.json",
    );

    this.critic.network = await tf.loadLayersModel(
      this.checkpoint_dir + "critic/model.json",
    );
  }

  choose_action(state: tf.Tensor2D, scheudle: Assignment[]) {
    return tf.tidy(() => {
      const logits = this.actor.forward(state);
      const values = this.critic.forward(state) as tf.Tensor2D;

      const actionLogits = logits[0].as2D(1, 6);
      const idLogits = logits[1];

      const validIds = Array.from({ length: scheudle.length }, (x, i) => i);

      const idMask = tf.tensor1d(
        Array.from({ length: MAX_TODOS }, (_, i) =>
          validIds.includes(i) ? 1 : 0,
        ),
      );

      // Logits maskieren: ungültige IDs auf -1e9 setzen
      const maskedIdLogits = idLogits
        .add(idMask.sub(1).mul(1e11))
        .as2D(1, MAX_TODOS);

      // Jetzt sampeln

      const ids = tf.multinomial(maskedIdLogits, 1);
      const actions = tf.multinomial(actionLogits, 1);

      const newActionLogProb = this.logP(actionLogits, actions, this.n_actions);
      const newIdLogProb = this.logP(idLogits, ids, MAX_TODOS);

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
    });
  }

  async learn(todos: number) {
    const {
      states,
      actions,
      ids,
      probabilities, // total log prob!
      critic_values,
      rewards,
      dones,
      batches,
    } = this.memory.generate_batches();

    // ---------- GAE ----------
    const advantage = new Array(rewards.length).fill(0);
    let gae = 0;

    for (let t = rewards.length - 1; t >= 0; t--) {
      const nextValue = t === rewards.length - 1 ? 0 : critic_values[t + 1];
      const delta =
        rewards[t] +
        this.gamma * nextValue * (dones[t] ? 0 : 1) -
        critic_values[t];

      gae = delta + this.gamma * this.gae_lambda * (dones[t] ? 0 : 1) * gae;
      advantage[t] = gae;
    }

    const returns = advantage.map((a, i) => a + critic_values[i]);

    // ---------- PPO Training ----------
    for (let epoch = 0; epoch < this.n_epochs; epoch++) {
      for (const batch of batches) {
        tf.tidy(() => {
          const batchStates = tf.tensor2d(
            batch.map((i) => states[i]),
            [batch.length, states[0].length],
          );

          const batchActions = tf.tensor1d(
            batch.map((i) => actions[i]),
            "int32",
          );
          const batchIds = tf.tensor1d(
            batch.map((i) => ids[i]),
            "int32",
          );

          const batchOldLogProbs = tf.tensor1d(
            batch.map((i) => probabilities[i]),
          );

          let batchAdv = tf.tensor1d(batch.map((i) => advantage[i]));
          const batchCriticValues = tf.tensor1d(
            batch.map((i) => critic_values[i]),
          );

          const batchReturns = tf.tensor1d(returns);

          // ---- Advantage Normalisierung ----
          const mean = tf.mean(batchAdv);
          const std = tf.moments(batchAdv).variance.sqrt().add(1e-8);

          console.log("MEAN");
          mean.print();
          console.log("STD");
          std.print();
          batchAdv = batchAdv.sub(mean).div(std);

          // ================= ACTOR =================
          this.actor_optimizer.minimize(() => {
            const [actionLogits, idLogits] = this.actor.forward(batchStates);

            // ---- Action log prob ----

            const actionLogP = this.logP(
              actionLogits,
              batchActions,
              this.n_actions,
            );

            const validIds = Array.from({ length: todos }, (x, i) => i);

            const idMask2D = tf.tensor2d(
              batch.map(() =>
                Array.from({ length: MAX_TODOS }, (_, i) =>
                  validIds.includes(i) ? 0 : -1e9,
                ),
              ),
            ); // shape [batch, MAX_TODOS]

            // 2. Mask auf die logits anwenden
            const maskedIdLogits = idLogits.add(idMask2D);

            // Logits maskieren: ungültige IDs auf -1e9 setzen

            // ---- ID log prob ----
            const idLogP = this.logP(maskedIdLogits, batchIds, MAX_TODOS);
            // ---- TOTAL LOG PROB ----

            const newTotalLogProb = actionLogP.add(idLogP);

            const ratio = tf.exp(newTotalLogProb.sub(batchOldLogProbs));

            const clippedRatio = tf.mul(
              tf.clipByValue(ratio, 1 - this.policy_clip, 1 + this.policy_clip),
              batchAdv,
            );

            const clippedLoss = tf.neg(
              tf.mean(tf.minimum(tf.mul(ratio, batchAdv), clippedRatio)),
            );

            // ---- Entropy Bonus ----
            const entropyAction = this.CalcEntropy(actionLogP);

            const entropyId = this.CalcEntropy(idLogP);

            const entropy = entropyAction.add(entropyId);

            const entropyLoss = tf.neg(tf.mean(entropy));

            const policyLoss = tf.sub(
              clippedLoss,
              entropyLoss.mul(this.entropy),
            );

            policyLoss.print();

            return policyLoss.asScalar();
          });

          // ================= CRITIC =================
          this.critic_optimizer.minimize(() => {
            const criticValue = this.critic.forward(batchStates) as tf.Tensor2D;

            const valueLoss = tf.losses
              .meanSquaredError(batchReturns, criticValue.as1D())
              .asScalar();

            return valueLoss;
          });
        });
      }
    }

    this.memory.clear_memory();

    console.log("DELETE");
  }

  CalcEntropy(logits: tf.Tensor) {
    const a0 = tf.sub(logits, tf.max(logits, -1, true));
    const exp_a0 = tf.exp(a0);
    const z0 = tf.sum(exp_a0, -1, true);

    const p0 = tf.div(exp_a0, z0);

    const entropy = tf.sum(tf.mul(p0, tf.sub(tf.log(z0), a0)), -1);

    return entropy;
  }

  logP(logits: tf.Tensor, action: tf.Tensor, num: number) {
    const logP_all = tf.softmax(logits);
    const one_hot = tf.oneHot(action, num);
    const logP = tf.sum(one_hot.mul(logP_all), -1);

    return logP;
  }
}
