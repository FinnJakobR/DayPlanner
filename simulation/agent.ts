import { Assignment } from "../csp/csp.js";
import { Action } from "./action.js";
import { Policy } from "./policy.js";
import State from "./state.js";

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
