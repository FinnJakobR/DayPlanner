import plan_day from "../dayplanner.js";
import Enviorment from "../simulation/enviorment.js";
import { saveScheudle } from "../util/utility.js";

async function main() {
  const PATH = "./scheudle.json";
  const env = new Enviorment();
  const tasks = env.generateTasks();
  const scheudle = await plan_day(tasks);
  saveScheudle(PATH, scheudle);
  console.log("sucessfull saved!");
}

main();
