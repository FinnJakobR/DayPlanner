import State from "./state.js";

export default interface StepResult {
  nextState: State;
  reward: number;
  done: boolean;
}
