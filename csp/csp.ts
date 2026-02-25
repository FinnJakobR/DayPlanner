import Genom, { MetaWeights } from "../models/genom.js";
import SoftScore from "../models/softscore.js";
import Task, { sumDurations } from "../models/task.js";
import {
  DAY_END_TIME,
  DAY_START_TIME,
  inSeconds,
  Time,
  Timing,
} from "../models/time.js";
import AC3 from "./ac3.js";
import { binaryConstrains } from "./contrains.js";
import {
  CSPGraph,
  CSPVertex,
  Domain,
  reduceTasks,
  removeValueFromDomain,
} from "./structs.js";

export class Assignment {
  public v: CSPVertex;
  public start: Time = new Time({
    hour: Infinity,
    minute: Infinity,
    second: 0,
  });
  public end: Time = new Time({ hour: Infinity, minute: Infinity, second: 0 });

  constructor(t: CSPVertex, start: Time) {
    this.v = t;
    this.start = start;
    this.end = Timing.add(this.v.task.duration, this.start);
  }
}

type TrailEntry = {
  variableId: string;
  value: Time;
};

export class CSP {
  private graph: CSPGraph;
  private ac3: AC3;
  private domain: Domain = new Map<string, Time[]>();

  private assignment: Assignment[] = [];
  private variables: CSPVertex[];
  private weigths: MetaWeights;
  private genom: Genom;

  private trail: TrailEntry[] = [];

  constructor(tasks: Task[], genom: Genom) {
    const sumOfDurations = sumDurations(tasks);
    this.weigths = genom.weights;
    this.genom = genom;

    if (
      sumOfDurations >= inSeconds(Timing.diff(DAY_END_TIME, DAY_START_TIME))
    ) {
      console.log(
        "Das sind zu viele Tasks Bro! Tag hat nur 24 std das geht nichtmal rein Mathmatisch!",
      );

      console.log(
        "Ich versuche jetzt die Tasks nach Prioritäten zu scheudlen!",
      );

      tasks = reduceTasks(tasks);
    }

    this.graph = new CSPGraph(tasks);
    this.variables = this.graph.getVeticies();
    this.generateDomain();

    this.ac3 = new AC3(this.graph, this.domain);
  }

  async run() {
    this.domain = await this.ac3.run();

    return this.backtracking();
  }

  generateDomain() {
    for (const variable of this.variables) {
      const domain: Time[] = [];
      for (let h = DAY_START_TIME.hour; h < DAY_END_TIME.hour; h++) {
        for (let m = 0; m < 60; m++) {
          domain.push(new Time({ hour: h, minute: m, second: 0 }));
        }
      }

      this.domain.set(
        variable.id,
        this.sortDomainFromGenomAndSoftScore(domain, variable.task),
      );
    }
  }

  shuffleDomain(d: Time[]): Time[] {
    let currentIndex = d.length;

    while (currentIndex != 0) {
      let randomIndex = Math.floor(Math.random() * currentIndex);

      currentIndex--;

      [d[currentIndex], d[randomIndex]] = [d[randomIndex], d[currentIndex]];
    }

    return d;
  }

  sortDomainFromGenomAndSoftScore(d: Time[], task: Task): Time[] {
    const preferredIndex = this.genom.priorities.get(task.id)!.slotIndex;

    if (
      preferredIndex !== undefined &&
      preferredIndex < d.length &&
      preferredIndex >= 0
    ) {
      const preferredSlot = d[preferredIndex];

      // Preferred Slot nach vorne ziehen
      d = [preferredSlot, ...d.filter((_, i) => i !== preferredIndex)];
    }

    // Rest (ab Index 1) nach SoftScore sortieren
    const head = d[0];
    const tail = d.slice(1);

    tail.sort(
      (a, b) => SoftScore(task, this.genom, b) - SoftScore(task, this.genom, a),
    );

    return [head, ...tail];
  }

  sortDomainFromSoftScoreWithShuffle(
    d: Time[],
    task: Task,
    k: number = 300,
  ): Time[] {
    d.sort(
      (a, b) => SoftScore(task, this.genom, b) - SoftScore(task, this.genom, a),
    );

    const topK = Math.min(k, d.length);

    for (let i = topK - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }

    return d;
  }

  // ----------------------------
  // GOAL CHECK
  // ----------------------------

  private isComplete(): boolean {
    return this.assignment.length === this.graph.getVeticies().length;
  }

  // ----------------------------
  // MRV (nicht mutierend!)
  // ----------------------------

  private selectVariable(): CSPVertex {
    return [...this.variables].sort(
      (a, b) => this.domain.get(a.id)!.length - this.domain.get(b.id)!.length,
    )[0];
  }

  // ----------------------------
  // CONSISTENCY CHECK
  // ----------------------------

  private isConsistent(value: Time, variable: CSPVertex): boolean {
    for (const a of this.assignment) {
      if (!binaryConstrains(value, a.start, variable, a.v)) {
        return false;
      }
    }
    return true;
  }

  // ----------------------------
  // DOMAIN EMPTY CHECK
  // ----------------------------

  private isDomainEmpty(): boolean {
    for (const v of this.variables) {
      if (this.domain.get(v.id)!.length === 0) return true;
    }
    return false;
  }

  // ----------------------------
  // TRAIL UNDO
  // ----------------------------

  private undoToCheckpoint(checkpoint: number) {
    while (this.trail.length > checkpoint) {
      const entry = this.trail.pop()!;
      this.domain.get(entry.variableId)!.push(entry.value);
    }
  }

  // ----------------------------
  // ASSIGN VARIABLE
  // ----------------------------

  private assign(variable: CSPVertex, value: Time) {
    const assignment = new Assignment(variable, value);
    this.assignment.push(assignment);

    // Domain auf {value} reduzieren
    const values = [...this.domain.get(variable.id)!];

    for (const val of values) {
      if (val !== value) {
        removeValueFromDomain(val, variable, this.domain);
        this.trail.push({
          variableId: variable.id,
          value: val,
        });
      }
    }

    // Variable aus "unassigned" entfernen
    this.variables = this.variables.filter((v) => v.id !== variable.id);

    return assignment;
  }

  // ----------------------------
  // UNASSIGN VARIABLE
  // ----------------------------

  private unassign(variable: CSPVertex) {
    this.assignment = this.assignment.filter((a) => a.v.id !== variable.id);
    this.variables.push(variable);
  }

  // ----------------------------
  // FORWARD CHECKING
  // ----------------------------

  private forwardChecking(a: Assignment) {
    const neighbours = this.graph.neighbours(a.v);

    for (const neighbour of neighbours) {
      if (!this.variables.includes(neighbour)) continue; //nicht mehr die testen die schon ein assignment haben

      for (const val of [...this.domain.get(neighbour.id)!]) {
        if (!binaryConstrains(val, a.start, neighbour, a.v)) {
          removeValueFromDomain(val, neighbour, this.domain);

          this.trail.push({
            variableId: neighbour.id,
            value: val,
          });
        }
      }
    }
  }

  // ----------------------------
  // BACKTRACKING
  // ----------------------------

  private backtracking(): Assignment[] {
    if (this.isComplete()) {
      return this.assignment;
    }

    const variable = this.selectVariable();

    for (const value of [...this.domain.get(variable.id)!]) {
      if (this.isConsistent(value, variable)) {
        const checkpoint = this.trail.length;

        const newAssignment = this.assign(variable, value);

        this.forwardChecking(newAssignment);

        if (!this.isDomainEmpty()) {
          try {
            return this.backtracking();
          } catch (e) {}
        }

        // Undo alles seit checkpoint
        this.undoToCheckpoint(checkpoint);

        this.unassign(variable);
      }
    }

    throw new Error("failure");
  }
}
