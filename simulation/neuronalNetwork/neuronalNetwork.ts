import * as tf from "@tensorflow/tfjs-node";

export default class ActorCritic {
  actor: tf.LayersModel;
  critic: tf.LayersModel;
  task: tf.LayersModel;
  duration: tf.LayersModel;
  time: tf.LayersModel;

  constructor(inputSize: number, numActions: number) {
    const inputs = tf.input({ shape: [inputSize] });

    const hidden1 = tf.layers
      .dense({ units: 128, activation: "relu" })
      .apply(inputs) as tf.SymbolicTensor;
    const hidden2 = tf.layers
      .dense({ units: 256, activation: "relu" })
      .apply(hidden1) as tf.SymbolicTensor;

    // Actor Head
    const actionProbs = tf.layers
      .dense({ units: numActions, activation: "softmax" })
      .apply(hidden2) as tf.SymbolicTensor;

    // Critic Head
    const stateValue = tf.layers
      .dense({ units: 1, activation: "linear" })
      .apply(hidden2) as tf.SymbolicTensor;

    const taskHead = tf.layers
      .dense({
        units: 100,
        activation: "softmax",
      })
      .apply(hidden2) as tf.SymbolicTensor;

    const timeHead = tf.layers
      .dense({
        units: 60,
        activation: "softmax",
      })
      .apply(hidden2) as tf.SymbolicTensor;

    const durationHead = tf.layers
      .dense({
        units: 60,
        activation: "softmax",
      })
      .apply(hidden2) as tf.SymbolicTensor;

    // Models
    this.actor = tf.model({ inputs, outputs: actionProbs });
    this.critic = tf.model({ inputs, outputs: stateValue });
    this.task = tf.model({ inputs, outputs: taskHead });
    this.time = tf.model({ inputs, outputs: timeHead });
    this.duration = tf.model({ inputs, outputs: durationHead });
  }

  forward(stateVector: tf.Tensor): {
    action: tf.Tensor2D;
    value: tf.Tensor;
    task: tf.Tensor2D;
    duration: tf.Tensor2D;
    time: tf.Tensor2D;
  } {
    return {
      action: this.actor.predict(stateVector) as tf.Tensor2D,
      value: this.critic.predict(stateVector) as tf.Tensor,
      task: this.task.predict(stateVector) as tf.Tensor2D,
      duration: this.duration.predict(stateVector) as tf.Tensor2D,
      time: this.time.predict(stateVector) as tf.Tensor2D,
    };
  }
}
