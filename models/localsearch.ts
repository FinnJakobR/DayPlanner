import { cloneGenom, decodeGenom } from "../util/utility.js";
import Fitness from "./fitness.js";
import Genom from "./genom.js";

export async function localImprove(genom: Genom): Promise<Genom> {
  let improved = true;

  while (improved) {
    improved = false;

    for (const taskId of genom.priorities.keys()) {
      const currentIndex = genom.priorities.get(taskId)!.slotIndex;
      const scheudle = await decodeGenom(genom);
      const currentFitness = Fitness(scheudle);

      for (const delta of [-1, 1]) {
        const newIndex = currentIndex + delta;
        genom.priorities.get(taskId)!.slotIndex = newIndex;

        const newScheudle = await decodeGenom(genom);
        const newFitness = Fitness(newScheudle);

        if (newFitness > currentFitness) {
          improved = true;
          break;
        } else {
          genom.priorities.get(taskId)!.slotIndex = currentIndex;
        }
      }
    }
  }

  return cloneGenom(genom);
}
