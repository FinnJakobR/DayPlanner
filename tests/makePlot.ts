import { exit } from "node:process";
import makePlot from "../util/plot.js";

const args: string[] = process.argv.slice(2);

if (!args[0]) {
  console.log("Please Provide a Step Count ex. 10");
  exit(-1);
}

if (!args[1]) {
  console.log("Please Provide a name for Gnu File ex. testScore");
  exit(-1);
}

makePlot("./score.txt", Number(args[0]), args[1]);
