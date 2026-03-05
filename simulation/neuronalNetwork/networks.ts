import * as tf from "@tensorflow/tfjs-node";
import { MAX_TODOS } from "../../util/utility.js";

export class CriticNetwork {
  public network: tf.LayersModel;
  constructor(
    input_dim: number,
    fc1_dims: number = 256,
    fc2_dims: number = 256,
  ) {
    this.network = this.buildModel(input_dim, fc1_dims, fc2_dims);
  }

  forward(state: tf.Tensor2D) {
    return this.network.apply(state, { training: true });
  }

  private buildModel(
    input_dim: number,
    fc1_dims: number = 32,
    fc2_dims: number = 32,
  ): tf.LayersModel {
    const model = tf.sequential();
    model.add(
      tf.layers.dense({
        inputShape: [input_dim],
        activation: "relu",
        units: fc1_dims,
      }),
    );

    model.add(
      tf.layers.dense({
        units: fc2_dims,
        activation: "relu",
      }),
    );

    model.add(
      tf.layers.dense({
        units: fc2_dims,
        activation: "relu",
      }),
    );

    model.add(
      tf.layers.dense({
        units: 1,
      }),
    );

    return model;
  }
}

export class ActorNetwork {
  public network: tf.LayersModel;
  constructor(
    input_dim: number,
    n_actions: number,
    fc1_dims: number = 256,
    fc2_dims: number = 256,
  ) {
    this.network = this.buildModel(input_dim, n_actions, fc1_dims, fc2_dims);
  }

  private buildModel(
    input_dim: number,
    n_actions: number,
    fc1_dims: number = 256,
    fc2_dims: number = 256,
  ): tf.LayersModel {
    // ---- Eingabe ----
    const input = tf.input({ shape: [input_dim] });

    // ---- Gemeinsamer Body ----
    const fc1 = tf.layers
      .dense({ units: fc1_dims, activation: "relu" })
      .apply(input) as tf.SymbolicTensor;
    const fc2 = tf.layers
      .dense({ units: fc2_dims, activation: "relu" })
      .apply(fc1) as tf.SymbolicTensor;

    // ---- Policy-Head ----
    const policy_logits = tf.layers
      .dense({ units: n_actions })
      .apply(fc2) as tf.SymbolicTensor;

    // ---- Optionaler Index-Head ----
    // z.B. Index-Head als Single Neuron → gibt “Task-Index-Wert” (Continuous) zurück
    const index_head = tf.layers
      .dense({ units: MAX_TODOS })
      .apply(fc2) as tf.SymbolicTensor;

    // ---- Modell mit 2 Outputs ----
    const model = tf.model({
      inputs: input,
      outputs: [policy_logits, index_head],
    });

    return model;
  }

  forward(state: tf.Tensor2D): [tf.Tensor, tf.Tensor] {
    // predict gibt Array zurück, weil 2 Outputs
    const [policy_logits, index_output] = this.network.apply(state, {
      training: true,
    }) as tf.Tensor[];

    return [policy_logits, index_output];
  }
}
