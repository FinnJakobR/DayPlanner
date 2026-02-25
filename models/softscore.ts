import Genom from "./genom.js";
import Task from "./task.js";
import { inSeconds, normalizeTime, Time } from "./time.js";

function lateScore(t: Time): number {
  return normalizeTime(t); // lineare Funktion wenn später desso besser
}

//TODO! oder ganz in fitness packen!
function gapScore(t: Time) {
  return 0.0;
}

export default function SoftScore(task: Task, genom: Genom, t: Time): number {
  let score =
    genom.weights.w_priority * genom.priorities.get(task.id)!.prority +
    genom.weights.w_late * lateScore(t) * genom.weights.w_gap * gapScore(t);

  return score;
}
