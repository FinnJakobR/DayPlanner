import State from "./state";

export default interface StepResult {
  nextState: State;
  reward: number;
  done: boolean;
}
