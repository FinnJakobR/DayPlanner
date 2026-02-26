import { Assignment } from "../csp/csp";
import { Action } from "./action";
import { Policy } from "./policy";
import State from "./state";

export interface Agent {
  selectAction(state: State): Action;
}

// export class PPOAgent implements Agent {
//   constructor(private policy: Policy) {}

//   //   selectAction(state: State): Action {
//   //     const logits = this.policy.forward(state);
//   //     //const actionIndex = sampleFromDistribution(logits);
//   //     return decodeAction(actionIndex);
//   //   }
// }
