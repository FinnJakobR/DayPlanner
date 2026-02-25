import Task, { sumDurations } from "../models/task.js";
import {
  DAY_END_TIME,
  DAY_START_TIME,
  inSeconds,
  Time,
  Timing,
} from "../models/time.js";

export type Domain = Map<string, Time[]>;

export function reduceTasks(t: Task[]): Task[] {
  const nT: Task[] = [];
  t = t.sort((a, b) => b.priority);

  let sumOfDurations = 0;

  let currentIndex = 0;

  while (
    sumOfDurations <= inSeconds(Timing.diff(DAY_END_TIME, DAY_START_TIME))
  ) {
    nT.push(t[currentIndex]);
    sumOfDurations = sumDurations(nT);
    currentIndex++;
  }

  return nT;
}

export function removeValueFromDomain(
  t: Time,
  vertex: CSPVertex,
  domain: Domain,
) {
  const d = domain.get(vertex.id)!;

  d.splice(
    d.findIndex(
      (a) => a.hour == t.hour && a.minute == t.minute && a.second == t.second,
    ),
    1,
  );

  domain.delete(vertex.id);
  domain.set(vertex.id, d);
}

export class CSPEdge {
  public x0: CSPVertex;
  public x1: CSPVertex;

  constructor(x0: CSPVertex, x1: CSPVertex) {
    this.x0 = x0;
    this.x1 = x1;
  }
}

export class CSPVertex {
  public id: string;
  public task: Task;

  constructor(task: Task) {
    this.task = task;
    this.id = this.task.id;
  }
}

export class CSPGraph {
  private V: CSPVertex[] = [];
  private E: CSPEdge[] = [];

  constructor(tasks: Task[]) {
    //generate Vertecies
    for (const task of tasks) {
      this.V.push(new CSPVertex(task));
    }

    //generate Edges
    for (let i = 0; i < this.V.length; i++) {
      for (let j = i + 1; j < this.V.length; j++) {
        this.E.push(new CSPEdge(this.V[i], this.V[j]));
      }
    }
  }

  getEdges() {
    return this.E;
  }

  getVeticies() {
    return this.V;
  }

  getEdgesFromVertex(v: CSPVertex) {
    return this.E.filter((e) => e.x0.id == v.id || e.x1.id == v.id);
  }

  neighbours(v: CSPVertex) {
    return this.V.filter((e) => e.id != v.id);
  }
}
