import * as tf from "@tensorflow/tfjs-node";

function getActionProbs(
  probs: tf.Tensor2D, // [batch, numActions]
  actions: tf.Tensor1D, // [batch]
  numActions: number,
): tf.Tensor1D {
  return tf.tidy(() => {
    const oneHot = tf.oneHot(actions, numActions); // [batch, numActions]
    const selected = probs.mul(oneHot).sum(1); // [batch]
    return selected as tf.Tensor1D;
  });
}

export function ppoLoss(
  oldProbs: tf.Tensor,
  newProbs: tf.Tensor,
  actionsTensor: tf.Tensor,
  advantages: tf.Tensor,

  clipEpsilon = 0.2,
) {
  return tf.tidy(() => {
    const newProbForAction = getActionProbs(
      newProbs as tf.Tensor2D,
      actionsTensor as tf.Tensor1D,
      actionsTensor.dataSync().length,
    );
    const oldProbForAction = getActionProbs(
      oldProbs as tf.Tensor2D,
      actionsTensor as tf.Tensor1D,
      actionsTensor.dataSync().length,
    );

    const logNew = newProbForAction.log();
    const logOld = oldProbForAction.log();
    const ratio = logNew.sub(logOld).exp();
    const clippedRatio = tf.clipByValue(
      ratio,
      1 - clipEpsilon,
      1 + clipEpsilon,
    );

    const loss1 = ratio.mul(advantages);
    const loss2 = clippedRatio.mul(advantages);

    const policyLoss = tf.minimum(loss1, loss2).mean().mul(-1); // Maximize → minimize negative
    return policyLoss;
  });
}
