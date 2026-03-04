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
  private learning_rate: number = 1e-3;
  private policy_clip: number = 0.2;
  private n_epochs: number = 5;
  private gae_lambda: number = 0.95;
  private batch_size: number = 20;
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
      this.checkpoint_dir + "actor",
    );

    this.critic.network = await tf.loadLayersModel(
      this.checkpoint_dir + "critic",
    );
  }

  choose_action(state: tf.Tensor2D, scheudle: Assignment[]) {
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

    const idlogProbs = tf.logSoftmax(maskedIdLogits);

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
          const batchReturns = tf.tensor1d(batch.map((i) => returns[i]));

          // ---- Advantage Normalisierung ----
          const mean = tf.mean(batchAdv);
          const std = tf.moments(batchAdv).variance.sqrt().add(1e-8);
          batchAdv = batchAdv.sub(mean).div(std);

          // ================= ACTOR =================
          this.actor_optimizer.minimize(() => {
            const [actionLogits, idLogits] = this.actor.forward(batchStates);

            // ---- Action log prob ----

            const actionLogProbs = tf.logSoftmax(actionLogits);

            const oneHotActions = tf.oneHot(batchActions, this.n_actions);
            const newActionLogProb = tf.sum(
              actionLogProbs.mul(oneHotActions),
              1,
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
            const idLogProbs = tf.logSoftmax(maskedIdLogits);

            const oneHotIds = tf.oneHot(batchIds, MAX_TODOS);
            const newIdLogProb = tf.sum(idLogProbs.mul(oneHotIds), 1);

            // ---- TOTAL LOG PROB ----

            const newTotalLogProb = newActionLogProb.add(newIdLogProb);

            const ratio = tf.exp(tf.sub(newTotalLogProb, batchOldLogProbs));

            const clippedRatio = tf.clipByValue(
              ratio,
              1 - this.policy_clip,
              1 + this.policy_clip,
            );

            const clipped = clippedRatio.mul(batchAdv);

            const policyLoss = tf.neg(
              tf.mean(tf.minimum(tf.mul(ratio, batchAdv), clipped)),
            );

            // ---- Entropy Bonus ----
            const entropyAction = tf.mean(
              tf.sum(tf.exp(actionLogProbs).mul(actionLogProbs).mul(-1), 1),
            );

            const entropyId = tf.mean(
              tf.sum(tf.exp(idLogProbs).mul(idLogProbs).mul(-1), 1),
            );

            const entropy = entropyAction.add(entropyId);

            return policyLoss.sub(entropy.mul(0.0055)).asScalar();
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
}
