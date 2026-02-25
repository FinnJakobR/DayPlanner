import { isBefore, Time, Timing } from "../models/time.js";
import { CSPVertex } from "./structs.js";

function overlappingConstrains(
  x0: Time,
  x1: Time,
  v0: CSPVertex,
  v1: CSPVertex,
) {
  //(s_i + d_i <= s_j) || (s_j + d_j <= s_i)

  return (
    isBefore(Timing.add(x0, v0.task.duration), x1) ||
    isBefore(Timing.add(x1, v1.task.duration), x0)
  );
}

function deadlineConstrained(ti: Time, vertex: CSPVertex): boolean {
  if (vertex.task.deadline.hour == Infinity) return false;
  return isBefore(vertex.task.deadline, ti);
}

export function unaryContrains(ti: Time, vertex: CSPVertex): boolean {
  return deadlineConstrained(ti, vertex);
}

export function binaryConstrains(
  x0: Time,
  x1: Time,
  v0: CSPVertex,
  v1: CSPVertex,
): boolean {
  return overlappingConstrains(x0, x1, v0, v1);
}
