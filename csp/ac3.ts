import { binaryConstrains, unaryContrains } from "./contrains.js";
import {
  CSPEdge,
  CSPGraph,
  CSPVertex,
  Domain,
  removeValueFromDomain,
} from "./structs.js";
import Queue from "../util/queue.js";

export default class AC3 {
  private graph: CSPGraph;
  private queue: Queue<CSPEdge>;
  private domain: Domain;

  constructor(graph: CSPGraph, domain: Domain) {
    this.graph = graph;
    this.queue = new Queue<CSPEdge>();
    this.domain = domain;

    const edges = this.graph.getEdges();
    const verticies = this.graph.getVeticies();

    this.enforceUnaryConstrains(verticies);

    for (const edge of edges) {
      this.queue.enqueue(edge);
    }
  }

  async run(): Promise<Domain> {
    return new Promise((resolve, reject) => {
      while (!this.queue.isEmpty()) {
        const currentEdge = this.queue.dequeue()!;

        if (this.removeInconsistentValues(currentEdge)) {
          const neighbours: CSPEdge[] = this.graph.getEdgesFromVertex(
            currentEdge.x0,
          );

          for (const neighbour of neighbours) {
            this.queue.enqueue(neighbour);
          }
        }
      }

      resolve(this.domain);
    });
  }

  removeInconsistentValues(edge: CSPEdge): boolean {
    let removed = false;

    const domainX0 = this.domain.get(edge.x0.id)!;
    const domainX1 = this.domain.get(edge.x1.id)!;

    for (const valX0 of [...domainX0]) {
      // Kopie wegen safe removal
      let hasSupport = false;

      for (const valX1 of domainX1) {
        if (binaryConstrains(valX0, valX1, edge.x0, edge.x1)) {
          hasSupport = true;
          break;
        }
      }

      if (!hasSupport) {
        removeValueFromDomain(valX0, edge.x0, this.domain);
        removed = true;
      }
    }

    return removed;
  }

  enforceUnaryConstrains(verticies: CSPVertex[]) {
    for (const vertex of verticies) {
      for (const ti of [...this.domain.get(vertex.id)!]) {
        if (unaryContrains(ti, vertex)) {
          removeValueFromDomain(ti, vertex, this.domain);
        }
      }
    }
  }
}
