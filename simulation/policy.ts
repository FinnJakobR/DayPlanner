import State from "./state";

export interface Policy {
  forward(state: State): number[]; // action probabilities
}
