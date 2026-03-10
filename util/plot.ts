import * as fs from "fs";
import { execSync } from "child_process";

export default function makePlot(
  scoreFile: string,
  steps: number,
  gnuFile: string,
) {
  const text = fs.readFileSync(scoreFile, "utf-8");

  const lines = text.split("\n");
  const data: string[] = [];

  let x = steps;

  for (const line of lines) {
    if (line.includes("avg_steps")) {
      const match = line.match(/avg_steps:\s*([0-9.]+)/);
      if (match) {
        const y = parseFloat(match[1]);
        data.push(`${x} ${y}`);
        x += steps;
      }
    }
  }

  const dataFile = `plots/${gnuFile}_data.txt`;
  fs.writeFileSync(dataFile, data.join("\n"));

  const gnuplotScript = `
set title "Average Steps"
set xlabel "Episodes"
set ylabel "Average Steps"

# automatische obere Grenze holen
stats "${dataFile}" using 1 nooutput
maxX = STATS_max

# vertikale Linien alle 2048 Episoden

do for [x=2048:maxX:2048] {
set arrow from x, graph 0 to x, graph 1 nohead dt 1 lw 2 lc rgb "#a71717"
}

plot "${dataFile}" using 1:2 with lines lw 2
pause -1
`;

  const scriptFile = `plots/${gnuFile}.gp`;
  fs.writeFileSync(scriptFile, gnuplotScript);

  execSync(`gnuplot ${scriptFile}`, { stdio: "inherit" });
}
