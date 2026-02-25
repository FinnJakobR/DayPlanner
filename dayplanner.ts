import { Assignment, CSP } from "./csp/csp.js";
import crossover from "./models/crossover.js";
import Fitness from "./models/fitness.js";
import Genom, { TaskPriority } from "./models/genom.js";
import { localImprove } from "./models/localsearch.js";
import mutation from "./models/mutation.js";
import { elitism, tournamentSelection } from "./models/selection.js";
import Task, { ActivityType } from "./models/task.js";
import { inSeconds, Time, Timing } from "./models/time.js";
import { generateFakeTasks } from "./tests/fakeTasks.js";
import { writeToFile } from "./util/debug.js";
import { cloneGenom, decodeGenom } from "./util/utility.js";

const POPULATION = 70;
const KONVERGENZE_LIMIT = 45;

function createPopulation(tasks: Task[]): Genom[] {
  const genoms: Genom[] = [];

  for (let i = 0; i < POPULATION; i++) {
    genoms.push(new Genom(tasks));
  }

  return genoms;
}

const plan_day = async () => {
  let nth_generation = 0;

  const tasks = generateFakeTasks(10);

  tasks[0].deadline = new Time({ hour: 15, minute: 40, second: 0 });
  tasks[0].activity = ActivityType.MENTAL_HEALTH;
  let generation = createPopulation(tasks);

  let lastBestFitness = 0;
  let epsilon = 0.00000003;
  let konvergenze = 0;

  while (konvergenze < KONVERGENZE_LIMIT) {
    let f = [];

    for (const individum of generation) {
      const scheudle = await decodeGenom(individum);
      individum.fitness = Fitness(scheudle);
      f.push(individum.fitness);
    }

    const bestFitenss = f.sort((a, b) => b - a)[0];

    console.log(
      "fitness",
      f.sort((a, b) => b - a)[0],
      "of Generation",
      nth_generation,
    );

    let newGeneration = [...elitism(generation, 4)]; // nehme die drei besten direkt in eine generation!

    for (
      let newGenom = newGeneration.length;
      newGenom < POPULATION;
      newGenom++
    ) {
      let selectedDad = tournamentSelection(generation, 3);
      let selectedMom = tournamentSelection(generation, 3);
      //TODO check ob die gleich sind!

      const child = crossover(selectedDad, selectedMom);

      const mutatedChild = mutation(cloneGenom(child));

      newGeneration.push(mutatedChild);
    }

    if (bestFitenss - lastBestFitness < epsilon) {
      konvergenze++;
    } else {
      konvergenze = 0;
    }

    lastBestFitness = bestFitenss;

    generation = newGeneration;

    nth_generation++;
  }

  for (const individum of generation) {
    const scheudle = await decodeGenom(individum);
    individum.fitness = Fitness(scheudle);
  }

  const finalSchedule = await decodeGenom(
    generation.sort((a, b) => b.fitness - a.fitness)[0],
  );
  console.log(
    "Sucessfull created Scheudle after " + nth_generation + " generations",
  );

  writeToFile("./tasks.txt", finalSchedule);
};

plan_day();
