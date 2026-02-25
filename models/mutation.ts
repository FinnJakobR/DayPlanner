import { calculateDomainLength, getRandomInt } from "../util/utility.js";
import Genom from "./genom.js";

export default function mutation(child: Genom): Genom {
  if (Math.random() < 0.3) return child;

  child.weights.w_gap =
    child.weights.w_gap + Math.random() * 0.2 * (Math.random() > 0.5 ? -1 : 1);

  child.weights.w_gap = Math.min(1, Math.max(0, child.weights.w_gap));

  child.weights.w_late =
    child.weights.w_late + Math.random() * 0.2 * (Math.random() > 0.5 ? -1 : 1);

  child.weights.w_late = Math.min(1, Math.max(0, child.weights.w_late));

  child.weights.w_priority =
    child.weights.w_priority +
    Math.random() * 0.2 * (Math.random() > 0.5 ? -1 : 1);

  child.weights.w_priority = Math.min(1, Math.max(0, child.weights.w_priority));

  //change random priorities
  const numOfChangedPos = Math.floor(
    Math.random() * Array.from(child.priorities.keys()).length,
  );

  const ids = Array.from(child.priorities.keys());

  for (let i = 0; i < numOfChangedPos; i++) {
    const key1 = ids[Math.floor(Math.random() * ids.length)];
    const key2 = ids[Math.floor(Math.random() * ids.length)];

    const key1Data = child.priorities.get(key1)!;
    const key2Data = child.priorities.get(key2)!;

    const swap = key1Data.prority;
    key1Data.prority = key2Data.prority;
    key2Data.prority = swap;

    child.priorities.delete(key1);
    child.priorities.set(key1, key1Data);

    child.priorities.delete(key2);
    child.priorities.set(key2, key2Data);
  }

  for (const id of child.priorities.keys()) {
    const r = Math.random();

    const t = child.priorities.get(id)!;

    if (r < 0.7) {
      t.slotIndex = getRandomInt(0, calculateDomainLength() - 1);
    }
  }

  return child;
}
