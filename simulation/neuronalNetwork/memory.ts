import { Action } from "../action.js";
import State from "../state.js";

function shuffle<T>(array: T[]): T[] {
  const x: T[] = array;

  let currentIndex = array.length;

  while (currentIndex != 0) {
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return x;
}

export default class Memory {
  private batch_size: number;
  private states: number[][] = [];
  private probabilities: number[] = [];
  private critic_values: number[] = [];
  private actions: number[][] = [];
  private rewards: number[] = [];
  private dones: boolean[] = [];

  constructor(batch_size: number) {
    this.batch_size = batch_size;
  }

  generate_batches() {
    const n_states = this.states.length;
    const batch_start = Array.from(
      { length: n_states },
      (e, i) => (i += this.batch_size),
    );

    const indicies = Array.from({ length: n_states }, (e, i) => i);
    const shuffled_indicies = shuffle<number>(indicies);

    const batches = [];

    for (const i of batch_start) {
      batches.push(shuffled_indicies.slice(i, i + this.batch_size));
    }

    return {
      states: this.states,
      actions: this.actions,
      probabilities: this.probabilities,
      critic_values: this.critic_values,
      rewards: this.rewards,
      dones: this.dones,
      batches: batches,
    };
  }

  store_memory(
    state: number[],
    action: number[],
    probabilities: number,
    critic_values: number,
    reward: number,
    done: boolean,
  ) {
    this.states.push(state);
    this.actions.push(action);
    this.probabilities.push(probabilities);
    this.critic_values.push(critic_values);
    this.rewards.push(reward);
    this.dones.push(done);
  }

  clear_memory() {
    this.states = [];
    this.actions = [];
    this.probabilities = [];
    this.critic_values = [];
    this.rewards = [];
    this.dones = [];
  }
}
