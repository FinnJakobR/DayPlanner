import State from "./state.js";

export interface Policy {
  forward(state: State): number[]; // action probabilities
}
