import { cloneGenom } from "../util/utility.js";
import Genom from "./genom.js";

export function elitism(population: Genom[], n: number): Genom[] {
  population = population.sort((a, b) => b.fitness - a.fitness);

  const newPopulation: Genom[] = [];

  for (let index = 0; index <= n; index++) {
    newPopulation.push(cloneGenom(population[index]));
  }

  return newPopulation;
}

//choose random k genome und sortiere nach fitness und nehme den besten
export function tournamentSelection(population: Genom[], n: number): Genom {
  let choosed: Genom[] = [];

  for (let i = 0; i < n; i++) {
    choosed.push(
      cloneGenom(population[Math.floor(Math.random() * population.length)]),
    );
  }

  choosed = choosed.sort((a, b) => b.fitness - a.fitness);

  return choosed[0];
}
